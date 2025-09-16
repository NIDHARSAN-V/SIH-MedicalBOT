import sys
import os

# Add the root directory (E:/sih-ChatBot) to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from voice_of_the_doctor import text_to_speech_with_elevenlabs


def create_preventive_measure_agent():
    """Returns a preventive measure agent node function with text and voice response."""
   

    def preventive_measure_agent(state):
        query = state.get("speech_to_text", state.get("query_text", ""))
        
        preventive_keywords = ["prevent", "prevention", "avoid", "reduce risk", "stay healthy", "tips"]
        
        if any(word in query.lower() for word in preventive_keywords):
            response_text = (
                "Here are some general preventive health measures:\n"
                "- Wash your hands regularly.\n"
                "- Eat a balanced diet.\n"
                "- Exercise regularly.\n"
                "- Get enough sleep.\n"
                "- Stay hydrated.\n"
                "- Avoid close contact with sick individuals.\n"
                "- Keep vaccinations up to date."
            )
        else:
            response_text = "Please specify what you want to prevent or ask for preventive tips."

        # Generate voice response from the text
        try:
            voice_of_doctor = text_to_speech_with_elevenlabs(
                input_text=response_text,
                output_filepath="final.mp3"  # You can use unique filenames if needed
            )
        except Exception as e:
            print(f"Voice generation failed: {e}")
            voice_of_doctor = None

        # Return the state with both text and audio responses
        return {
            "doctor_response": response_text,
            "image_filepath": None,  # Clear unused fields
            "voice_of_doctor": voice_of_doctor
        }

    return preventive_measure_agent
