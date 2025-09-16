import sys
import os

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from voice_of_the_doctor import text_to_speech_with_elevenlabs
from .preventive_rag_agent import create_preventive_rag_agent
from .preventive_youtube_agent import create_preventive_youtube_agent

def create_preventive_measure_agent():
    """Main preventive measure agent that integrates RAG and YouTube agents with voice response."""

    rag_agent = create_preventive_rag_agent()
    youtube_agent = create_preventive_youtube_agent()

    def preventive_measure_agent(state):
        query = state.get("speech_to_text", state.get("query_text", ""))
        
        preventive_keywords = ["prevent", "prevention", "avoid", "reduce risk", "stay healthy", "tips"]
        
        if not any(word in query.lower() for word in preventive_keywords):
            response_text = "Please specify what you want to prevent or ask for preventive tips."
            voice_of_doctor = None
            return {
                "doctor_response": response_text,
                "image_filepath": None,
                "voice_of_doctor": voice_of_doctor
            }

        # Get data from sub-agents
        rag_result = rag_agent(state)
        youtube_result = youtube_agent(state)

        response_text = (
            "Here are some preventive measures:\n\n"
            "From the web:\n"
            f"{rag_result.get('rag_response')}\n\n"
            "YouTube links:\n"
            f"{youtube_result.get('youtube_response')}"
        )

        try:
            voice_of_doctor = text_to_speech_with_elevenlabs(
                input_text=response_text,
                output_filepath="final.mp3"
            )
        except Exception as e:
            print(f"Voice generation failed: {e}")
            voice_of_doctor = None

        return {
            "doctor_response": response_text,
            "image_filepath": None,
            "voice_of_doctor": voice_of_doctor
        }

    return preventive_measure_agent
