import os
import json
import http.client
from dotenv import load_dotenv

from langchain_groq import ChatGroq

# ------------------ Load Environment Variables ------------------
load_dotenv()
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
GOOGLE_SERPER_API_KEY = os.getenv('GOOGLE_SERPER_API_KEY')

# ------------------ Initialize LLM ------------------
llm = ChatGroq(
    groq_api_key=GROQ_API_KEY,
    model_name="llama-3.1-8b-instant",
    temperature=0.2
)

llm_disease = llm

# ------------------ Factory-style YouTube Preventive Agent ------------------
def create_preventive_youtube_agent():

    def preventive_youtube_agent(state):
        query = state.get("speech_to_text", state.get("query_text", "")).strip()
        if not query:
            return {"youtube_response": "Please provide a valid query."}

        # ---- Step 1: Identify Disease ----
        prompt = f"Identify the disease mentioned in this query: '{query}'"
        response = llm_disease.invoke(prompt)
        disease = response.content.strip()
        print(f"[Groq] Identified disease: {disease}")

        # ---- Step 2: Search YouTube via Google Serper ----
        try:
            conn = http.client.HTTPSConnection("google.serper.dev")
            payload = json.dumps({
                "q": f"preventive health tips for {disease} site:youtube.com"
            })
            headers = {'X-API-KEY': GOOGLE_SERPER_API_KEY, 'Content-Type': 'application/json'}
            conn.request("POST", "/videos", payload, headers)
            res = conn.getresponse()
            
            data = res.read()
            result = json.loads(data.decode("utf-8"))
            conn.close()

            videos = []
            # Updated key to 'videos' for Serper Videos API
            for item in result.get("videos", []):
                title = item.get("title", "")
                link = item.get("link") or item.get("videoUrl", "")
                videos.append(f"{title}\n{link}")

            final_text = "\n\n".join(videos) if videos else "No YouTube videos found."
        except Exception as e:
            final_text = f"Error retrieving YouTube links: {e}"

        return {"youtube_response": final_text}

    return preventive_youtube_agent


# ------------------ Example Usage ------------------
if __name__ == "__main__":
    agent = create_preventive_youtube_agent()
    query_input = {"query_text": "Tell me about malaria prevention"}
    result = agent(query_input)
    print("\n--- YouTube Video Results ---")
    print(result["youtube_response"])
