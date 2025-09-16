from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional
from .image_voice_agent import create_image_voice_agent
from .rag_agent import create_rag_agent

class SymptomState(TypedDict):
    audio_filepath: Optional[str]
    image_filepath: Optional[str]
    query_text: Optional[str]
    speech_to_text: Optional[str]
    doctor_response: Optional[str]
    voice_of_doctor: Optional[str]
    next_node: Optional[str]  # Add this field

def route_symptom_analysis(state: SymptomState):
    """Determine which symptom analysis approach to use"""
    if state.get("image_filepath"):
        return {"next_node": "image_voice_agent"}
    else:
        return {"next_node": "rag_agent"}

def create_symptom_agent():
    """Create the symptom agent workflow"""
    workflow = StateGraph(SymptomState)
    
    # Add nodes
    workflow.add_node("route", route_symptom_analysis)
    workflow.add_node("image_voice_agent", create_image_voice_agent())
    workflow.add_node("rag_agent", create_rag_agent())
    
    # Set entry point
    workflow.set_entry_point("route")
    
    # Add edges
    workflow.add_conditional_edges(
        "route",
        # Check the next_node field to determine where to go
        lambda state: state.get("next_node", "rag_agent"),
        {
            "image_voice_agent": "image_voice_agent",
            "rag_agent": "rag_agent"
        }
    )
    workflow.add_edge("image_voice_agent", END)
    workflow.add_edge("rag_agent", END)
    
    return workflow.compile()