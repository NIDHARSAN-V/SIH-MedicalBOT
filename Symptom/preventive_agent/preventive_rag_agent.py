import os
import json
import http.client
from dotenv import load_dotenv

from langchain_groq import ChatGroq
from langchain.embeddings import SentenceTransformerEmbeddings
from langchain.vectorstores import FAISS
from langchain.schema import Document

# ------------------ Load Environment Variables ------------------
load_dotenv()
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
GOOGLE_SERPER_API_KEY = os.getenv('GOOGLE_SERPER_API_KEY')
SCRAPE_SERPER_API_KEY = os.getenv('GOOGLE_SERPER_API_KEY')

# ------------------ Initialize LLMs ------------------
llm = ChatGroq(
    groq_api_key=GROQ_API_KEY,
    model_name="llama-3.1-8b-instant",
    temperature=0.2
)

llm_disease = llm

# ------------------ Embeddings + FAISS ------------------
embedding_function = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
vector_store = FAISS.from_texts([""], embedding_function)  # Initialize empty FAISS

# ------------------ Factory-style RAG Agent ------------------
def create_preventive_rag_agent():

    def preventive_rag_agent(state):
        query = state.get("speech_to_text", state.get("query_text", "")).strip()
        if not query:
            return {"rag_response": "Please provide a valid query."}

        # ---- Step 1: Identify Disease ----
        prompt = f"Identify the disease mentioned in this query: '{query}'"
        response = llm_disease.invoke(prompt)
        disease = response.content.strip()
        print(f"[Groq] Identified disease: {disease}")

        # ---- Step 2: Check Existing Vector Store ----
        if vector_store.index is None or vector_store.index.ntotal == 0:
            docs = []
        else:
            docs = vector_store.similarity_search(query, k=3)

        # ---- Step 3: If not found, search & scrape ----
        if not docs:
            try:
                # Search Google Serper
                conn = http.client.HTTPSConnection("google.serper.dev")
                payload = json.dumps({"q": f"{disease} preventive measures from wikipedia"})
                headers = {'X-API-KEY': GOOGLE_SERPER_API_KEY, 'Content-Type': 'application/json'}
                conn.request("POST", "/search", payload, headers)
                res = conn.getresponse()
                data = res.read()
                search_result = json.loads(data.decode("utf-8"))
                links = [item.get("link") for item in search_result.get("organic", [])]
                conn.close()
                print(f"[Google Serper] Found {len(links)} links.")
            except Exception as e:
                return {"rag_response": f"Error during search: {e}"}

            # Scrape top 5 links
            for link in links[:5]:
                try:
                    conn = http.client.HTTPSConnection("scrape.serper.dev")
                    formatted_url = link.replace("https://", "").replace("/", "_")
                    payload = json.dumps({"url": formatted_url})
                    headers = {'X-API-KEY': SCRAPE_SERPER_API_KEY, 'Content-Type': 'application/json'}
                    conn.request("POST", "/", payload, headers)
                    res = conn.getresponse()
                    data = res.read()
                    scrape_result = json.loads(data.decode("utf-8"))
                    content = scrape_result.get("content", "")
                    conn.close()
                    if content:
                        doc = Document(page_content=content, metadata={"source": link})
                        vector_store.add_documents([doc])
                        docs.append(doc)
                    print(f"[Scrape Serper] Scraped content from {link}")
                except Exception as e:
                    print(f"Error scraping {link}: {e}")

        # ---- Step 4: Generate Augmented Response ----
        if docs:
            context_text = "\n\n".join([doc.page_content for doc in docs])
            prompt = (
                f"Using the following context, answer the question detailed:\n\n"
                f"Context:\n{context_text}\n\n"
                f"Question: {query}\n\nAnswer:"
            )
            response = llm.invoke(prompt)
            final_text = response.content.strip()
        else:
            final_text = "No relevant information found after scraping."

        return {"rag_response": final_text}

    return preventive_rag_agent