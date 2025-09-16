from dotenv import load_dotenv
load_dotenv()

from main_agent import create_main_agent
import gradio as gr

def process_inputs(audio_filepath, image_filepath, query_text):
    # Initialize the main agent
    agent = create_main_agent()
    
    # Prepare inputs for the agent
    inputs = {
        "audio_filepath": audio_filepath,
        "image_filepath": image_filepath,
        "query_text": query_text
    }
    
    # Process through the agent
    result = agent.invoke(inputs)
    
    return result.get("speech_to_text", ""), result.get("doctor_response", ""), result.get("voice_of_doctor", "")

# Create the interface
iface = gr.Interface(
    fn=process_inputs,
    inputs=[
        gr.Audio(sources=["microphone"], type="filepath"),
        gr.Image(type="filepath"),
        gr.Textbox(label="Optional text query", placeholder="Or type your question here...")
    ],
    outputs=[
        gr.Textbox(label="Speech to Text"),
        gr.Textbox(label="Doctor's Response"),
        gr.Audio("Temp.mp3")
    ],
    title="AI Doctor with Vision and Voice"
)

if __name__ == "__main__":
    iface.launch(debug=True)