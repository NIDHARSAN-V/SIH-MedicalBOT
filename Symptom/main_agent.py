from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional
from symptom_agent.symptom_agent import create_symptom_agent
from preventive_agent.preventive_measure_agent import create_preventive_measure_agent
import os

# Define the structure of the agent's state
class AgentState(TypedDict):
    audio_filepath: Optional[str]
    image_filepath: Optional[str]
    query_text: Optional[str]
    speech_to_text: Optional[str]
    doctor_response: Optional[str]
    voice_of_doctor: Optional[str]
    requires_symptom_analysis: bool
    next_node: Optional[str]  # Track the next node
    

def route_inputs(state: AgentState):
    """Use LLM classification to decide the next node"""
    from groq import Groq

    query = state.get("query_text", "") or state.get("speech_to_text", "")

    client = Groq()
    response = client.chat.completions.create(
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a medical assistant that categorizes user queries into one of the following types:\n"
                    "1. symptom — queries about medical symptoms, diseases, or health issues.\n"
                    "2. preventive — queries about prevention, tips, remedies, or staying healthy.\n"
                    "3. general — all other queries not related to symptoms or prevention.\n"
                    "Respond only with one of these words."
                )
            },
            {
                "role": "user",
                "content": f"Categorize this query:\n{query}"
            }
        ],
        model="llama-3.1-8b-instant"
    )

    classification = response.choices[0].message.content.strip().lower()
    print("CLASSIFICATION =======", classification)

    switch = {
        "symptom": {"next_node": "symptom_agent"},
        "preventive": {"next_node": "preventive_measure_agent"},
        "general": {"next_node": "general_response"}
    }

    return switch.get(classification, {"next_node": "general_response"})


def transcribe_audio(state: AgentState):
    """Transcribe audio if provided"""
    from voice_of_the_patient import transcribe_with_groq

    if state.get("audio_filepath"):
        try:
            speech_to_text = transcribe_with_groq(
                GROQ_API_KEY=os.environ.get("GROQ_API_KEY"),
                audio_filepath=state["audio_filepath"],
                stt_model="whisper-large-v3"
            )
            return {"speech_to_text": speech_to_text}
        except Exception as e:
            print(f"Audio transcription failed: {e}")
            return {"speech_to_text": "Could not transcribe audio. Please try again or type your question."}
    return {"speech_to_text": state.get("query_text", "")}


def general_response(state: AgentState):
    """Handle general non-symptom queries"""
    from groq import Groq

    query = state.get("speech_to_text", state.get("query_text", ""))

    if not query:
        return {"doctor_response": "Please ask a question or describe your symptoms."}

    try:
        client = Groq()
        response = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful medical assistant. Answer general health questions but defer to doctors for specific symptoms. "
                        "Be concise and helpful."
                    )
                },
                {
                    "role": "user",
                    "content": query
                }
            ],
            model="llama-3.1-8b-instant"
        )
        return {"doctor_response": response.choices[0].message.content}
    except Exception as e:
        print(f"Error during general response: {e}")
        return {"doctor_response": "I'm having trouble processing your request right now."}


def create_main_agent():
    """Create the main agent workflow"""
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("transcribe", transcribe_audio)
    workflow.add_node("route", route_inputs)
    workflow.add_node("symptom_agent", create_symptom_agent())
    workflow.add_node("preventive_measure_agent", create_preventive_measure_agent())
    workflow.add_node("general_response", general_response)

    # Set entry point
    workflow.set_entry_point("transcribe")

    # Add edges
    workflow.add_edge("transcribe", "route")

    # Conditional routing based on next_node field
    workflow.add_conditional_edges(
        "route",
        lambda state: state.get("next_node", "general_response"),
        {
            "symptom_agent": "symptom_agent",
            "preventive_measure_agent": "preventive_measure_agent",
            "general_response": "general_response"
        }
    )

    # End states
    workflow.add_edge("symptom_agent", END)
    workflow.add_edge("preventive_measure_agent", END)
    workflow.add_edge("general_response", END)

    return workflow.compile()



