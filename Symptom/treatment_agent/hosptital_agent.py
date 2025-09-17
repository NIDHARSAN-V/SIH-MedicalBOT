import http.client
import json
import os
from typing import TypedDict, Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Define the state structure
class AgentState(TypedDict):
    audio_filepath: Optional[str]
    image_filepath: Optional[str]
    query_text: Optional[str]
    speech_to_text: Optional[str]
    latitude: Optional[str]
    longitude: Optional[str]
    user_ip: Optional[str]
    doctor_response: Optional[str]
    voice_of_doctor: Optional[str]
    requires_symptom_analysis: bool
    next_node: Optional[str]


def hospitals_agent(state: AgentState):
    query =  state.get("query_text", "")
    print("HOSPITALS AGENT QUERY =======", query)
    latitude = state.get("latitude")
    longitude = state.get("longitude")

    if not latitude or not longitude:
        return {"doctor_response": "Location data (latitude and longitude) is missing."}

    ll = f"@{latitude},{longitude},10z"

    conn = http.client.HTTPSConnection("google.serper.dev")
    payload = json.dumps({
        "q": query,
        "ll": ll
    })

    api_key = os.getenv("GOOGLE_SERPER_API_KEY")
    if not api_key:
        return {"doctor_response": "API key is missing. Please check your .env file."}

    headers = {
        'X-API-KEY': api_key,
        'Content-Type': 'application/json'
    }

    try:
        conn.request("POST", "/maps", payload, headers)
        res = conn.getresponse()
        data = res.read()
        result = json.loads(data.decode("utf-8"))
        
        print("API RESPONSE =======", result)

        places = result.get("places", [])
        if not places:
            return {"doctor_response": "No hospitals found nearby for your treatment query."}

        response_text = "Here are some hospitals near you:\n"
        for place in places[:5]:
            name = place.get("title")
            address = place.get("address")
            phone = place.get("phoneNumber", "N/A")
            website = place.get("website", "N/A")
            response_text += f"\n🏥 {name}\n📍 {address}\n📞 {phone}\n🔗 {website}\n"

        return {"doctor_response": response_text}

    except Exception as e:
        print(f"Error fetching hospital data: {e}")
        return {"doctor_response": "Sorry, I couldn't retrieve hospital information at this moment."}


def main():
    state = AgentState(
        audio_filepath=None,
        image_filepath=None,
        query_text="hospitals in Perundurai ",
        speech_to_text=None,
        latitude="11.2889121",    # Example latitude
        longitude="77.5821645",   # Example longitude
        user_ip=None,
        doctor_response=None,
        voice_of_doctor=None,
        requires_symptom_analysis=False,
        next_node=None
    )

    result = hospitals_agent(state)
    print(result["doctor_response"])
