from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional
from brain_of_the_doctor import encode_image, analyze_image_with_query
from voice_of_the_doctor import text_to_speech_with_elevenlabs

class ImageVoiceState(TypedDict):
    audio_filepath: Optional[str]
    image_filepath: Optional[str]
    query_text: Optional[str]
    speech_to_text: Optional[str]
    doctor_response: Optional[str]
    voice_of_doctor: Optional[str]

system_prompt = """You have to act as a professional doctor, i know you are not but this is for learning purpose. 
What's in this image?. Do you find anything wrong with it medically? 
If you make a differential, suggest some remedies for them. Donot add any numbers or special characters in 
your response. Your response should be in one long paragraph. Also always answer as if you are answering to a real person.
Donot say 'In the image I see' but say 'With what I see, I think you have ....'
Dont respond as an AI model in markdown, your answer should mimic that of an actual doctor not an AI bot, 
Keep your answer concise (max 2 sentences). No preamble, start your answer right away please"""

def analyze_image(state: ImageVoiceState):
    """Analyze the image and provide medical insights"""
    if state.get("image_filepath"):
        query = system_prompt + (state.get("speech_to_text", "") or state.get("query_text", ""))
        doctor_response = analyze_image_with_query(
            query=query, 
            encoded_image=encode_image(state["image_filepath"]), 
            model="meta-llama/llama-4-scout-17b-16e-instruct"
        )
        return {"doctor_response": doctor_response}
    return {"doctor_response": "No image provided for analysis"}

def generate_voice_response(state: ImageVoiceState):
    """Convert the doctor's response to speech"""
    if state.get("doctor_response"):
        voice_of_doctor = text_to_speech_with_elevenlabs(
            input_text=state["doctor_response"], 
            output_filepath="final.mp3"
        )
        return {"voice_of_doctor": voice_of_doctor}
    return {"voice_of_doctor": None}

def create_image_voice_agent():
    """Create the image and voice agent workflow"""
    workflow = StateGraph(ImageVoiceState)
    
    # Add nodes
    workflow.add_node("analyze_image", analyze_image)
    workflow.add_node("generate_voice", generate_voice_response)
    
    # Set entry point
    workflow.set_entry_point("analyze_image")
    
    # Add edges
    workflow.add_edge("analyze_image", "generate_voice")
    workflow.add_edge("generate_voice", END)
    
    return workflow.compile()