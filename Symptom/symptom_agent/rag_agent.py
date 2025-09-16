from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional, List
from langchain_groq import ChatGroq
from langchain_community.document_loaders import PyPDFLoader, WebBaseLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.prompts import ChatPromptTemplate
from langchain.schema import Document
from voice_of_the_doctor import text_to_speech_with_elevenlabs
import os

class RAGState(TypedDict):
    audio_filepath: Optional[str]
    image_filepath: Optional[str]
    query_text: Optional[str]
    speech_to_text: Optional[str]
    doctor_response: Optional[str]
    voice_of_doctor: Optional[str]

# Set USER_AGENT environment variable to avoid warnings
os.environ["USER_AGENT"] = "MedicalAIAssistant/1.0 (Research Project; contact: admin@example.com)"

# Medical URLs for RAG - using more accessible sources
MEDICAL_URLS = [
    "https://www.cdc.gov/coronavirus/2019-ncov/symptoms-testing/symptoms.html",
    "https://www.nhs.uk/common-health-questions/accidents-first-aid-and-treatments/",
    "https://www.mayoclinic.org/symptoms",
    "https://medlineplus.gov/symptoms.html"
]

def setup_rag_database():
    """Set up the RAG database with medical information"""
    documents = []
    
    # Load PDF if exists
    if os.path.exists("med.pdf"):
        try:
            pdf_loader = PyPDFLoader("med.pdf")
            documents.extend(pdf_loader.load())
            print(f"Loaded {len(documents)} pages from PDF")
        except Exception as e:
            print(f"Failed to load PDF: {e}")
    
    # Load from medical URLs with proper error handling
    for url in MEDICAL_URLS:
        try:
            # Set headers to avoid blocking
            headers = {
                "User-Agent": "MedicalAIAssistant/1.0 (Research Project; contact: admin@example.com)"
            }
            web_loader = WebBaseLoader(url, header_template=headers)
            loaded_docs = web_loader.load()
            documents.extend(loaded_docs)
            print(f"Loaded {len(loaded_docs)} documents from {url}")
        except Exception as e:
            print(f"Failed to load {url}: {e}")
            # Add a fallback document with basic medical information
            fallback_doc = Document(
                page_content=f"Could not load content from {url}. This is a fallback medical information source.",
                metadata={"source": "fallback", "url": url}
            )
            documents.append(fallback_doc)
    
    if not documents:
        # Add some basic medical information as fallback
        basic_medical_info = [
            "Common symptoms include fever, cough, headache, and fatigue.",
            "Always consult a healthcare professional for medical advice.",
            "Seek immediate medical attention for severe symptoms like chest pain or difficulty breathing."
        ]
        for i, info in enumerate(basic_medical_info):
            documents.append(Document(page_content=info, metadata={"source": "fallback", "id": i}))
    
    # Split documents
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    texts = text_splitter.split_documents(documents)
    
    # Create embeddings and vector store
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vectorstore = Chroma.from_documents(documents=texts, embedding=embeddings, persist_directory="./chroma_db")
    vectorstore.persist()
    
    return vectorstore

# Cache the vectorstore to avoid rebuilding it every time
_vectorstore = None

def get_vectorstore():
    """Get the vectorstore, creating it if it doesn't exist"""
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = setup_rag_database()
    return _vectorstore

def query_rag_system(state: RAGState):
    """Query the RAG system for medical information"""
    query = state.get("speech_to_text", "") or state.get("query_text", "")
    
    if not query:
        return {"doctor_response": "Please provide a question or description of your symptoms."}
    
    # Set up RAG system0
    vectorstore = get_vectorstore()
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
    relevant_docs = retriever.get_relevant_documents(query)
    
    # Prepare context
    context = "\n\n".join([doc.page_content for doc in relevant_docs])
    
    # Query the LLM with context
    llm = ChatGroq(
        groq_api_key=os.environ.get("GROQ_API_KEY"),
        model_name="llama-3.1-8b-instant"
    )
    
    prompt = ChatPromptTemplate.from_template("""
    You are a medical assistant. Use the following context to answer the user's question.
    If you don't know the answer, say so. Always recommend consulting a real doctor for serious concerns.
    Be concise and helpful in your response.
    
    Context: {context}
    
    Question: {question}
    
    Answer:
    """)
    
    chain = prompt | llm
    response = chain.invoke({"context": context, "question": query})
    
    return {"doctor_response": response.content}

def generate_voice_response(state: RAGState):
    """Convert the doctor's response to speech"""
    if state.get("doctor_response"):
        voice_of_doctor = text_to_speech_with_elevenlabs(
            input_text=state["doctor_response"], 
            output_filepath="final.mp3"
        )
        return {"voice_of_doctor": voice_of_doctor}
    return {"voice_of_doctor": None}

def create_rag_agent():
    """Create the RAG agent workflow"""
    workflow = StateGraph(RAGState)
    
    # Add nodes
    workflow.add_node("query_rag", query_rag_system)
    workflow.add_node("generate_voice", generate_voice_response)
    
    # Set entry point
    workflow.set_entry_point("query_rag")
    
    # Add edges
    workflow.add_edge("query_rag", "generate_voice")
    workflow.add_edge("generate_voice", END)
    
    return workflow.compile()