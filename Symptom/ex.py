from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
from main_agent import create_main_agent
import os
from werkzeug.utils import secure_filename

load_dotenv()

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def home():
    return "AI Doctor Backend is running."
@app.route('/download/<filename>')
def download_file(filename):
    try:
        # Make sure the filename is safe
        print("Filename received for download:", filename)
        safe_filename = secure_filename(filename)
        
        # Create the full path to the file in the CURRENT directory
        file_path = os.path.join(os.path.dirname(__file__), safe_filename)
        
        print(f"Looking for file at: {file_path}")
        
        # Check if the file exists
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            # List files in current directory for debugging
            current_dir = os.path.dirname(__file__)
            print(f"Files in current directory: {os.listdir(current_dir)}")
            return "File not found", 404
        
        print(f"File found: {file_path}")
        
        # Send the file with correct headers for audio playback
        return send_file(
            file_path, 
            as_attachment=False,  # Don't force download, allow playback
            mimetype='audio/mpeg',  # Set correct MIME type for MP3
            conditional=True  # Enable conditional requests (304 responses)
        )
        
    except Exception as e:
        print(f"Error in download endpoint: {str(e)}")
        traceback.print_exc()
        return "Error downloading file", 500
    

@app.route('/process', methods=['POST'])
def process():
    agent = create_main_agent()

    # Retrieve files and text
    audio_file = request.files.get('audio')
    image_file = request.files.get('image')
    query_text = request.form.get('query_text', '')

    audio_filepath = ""
    image_filepath = ""

    # Save uploaded files
    if audio_file:
        filename = secure_filename(audio_file.filename)
        audio_filepath = os.path.join(UPLOAD_FOLDER, filename)
        audio_file.save(audio_filepath)

    if image_file:
        filename = secure_filename(image_file.filename)
        image_filepath = os.path.join(UPLOAD_FOLDER, filename)
        image_file.save(image_filepath)

    # Prepare inputs
    inputs = {
        "audio_filepath": audio_filepath,
        "image_filepath": image_filepath,
        "query_text": query_text
    }
    
    
    

    # Process with agent
    result = agent.invoke(inputs)

    # Prepare paths for audio output if generated
    voice_of_doctor_path = result.get("voice_of_doctor", "")
    if voice_of_doctor_path and os.path.exists(voice_of_doctor_path):
        # Return URL path to the file
        voice_url = f"/download/{os.path.basename(voice_of_doctor_path)}"
    else:
        voice_url = ""

    response = {
        "speech_to_text": result.get("speech_to_text", ""),
        "doctor_response": result.get("doctor_response", ""),
        "voice_of_doctor": voice_url
    }

    return jsonify(response)

@app.route('/download/<filename>', methods=['GET'])
def download(filename):
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    return "File not found", 404

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
