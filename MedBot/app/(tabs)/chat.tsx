import { useState, useRef } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ListRenderItem,
  View,
  Text,
  Image,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";

type Message = {
  id: string;
  text?: string;
  sender: "user" | "bot";
  imageUri?: string;
  audioUri?: string;
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", text: "Hello! How can I assist you today?", sender: "bot" },
  ]);
  const [inputText, setInputText] = useState<string>("");
  const [audioFile, setAudioFile] = useState<any>(null);
  const [imageFile, setImageFile] = useState<any>(null);
  const [cameraFile, setCameraFile] = useState<any>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  /** Toggle recording on button click */
  const toggleRecording = async () => {
    try {
      if (isRecording) {
        // Stop recording
        const recording = recordingRef.current;
        if (!recording) return;

        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();

        setAudioFile({
          uri,
          name: `recording-${Date.now()}.m4a`,
          mimeType: "audio/m4a",
        });

        recordingRef.current = null;
        setIsRecording(false);
      } else {
        // Start recording
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          alert("Microphone permission is required!");
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        await recording.startAsync();
        recordingRef.current = recording;
        setIsRecording(true);
      }
    } catch (err) {
      console.error("Error toggling recording", err);
    }
  };

  /** Play recorded/uploaded audio */
  const playAudio = async (uri: string) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();
    } catch (err) {
      console.error("Error playing audio", err);
    }
  };

  /** Send message */
  const sendMessage = async () => {
    if (!inputText.trim() && !audioFile && !imageFile && !cameraFile) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: "user",
      imageUri: imageFile?.uri || cameraFile?.uri,
      audioUri: audioFile?.uri,
    };
    setMessages((prev) => [...prev, newMessage]);
    setInputText("");

    // Reset files
    setAudioFile(null);
    setImageFile(null);
    setCameraFile(null);

    // Fake bot reply
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: "Thanks for your message!",
          sender: "bot",
        },
      ]);
    }, 1000);
  };

  /** Pick image from gallery */
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageFile({
        uri: result.assets[0].uri,
        name: result.assets[0].uri.split("/").pop(),
        type: "image/jpeg",
      });
    }
  };

  /** Pick image using camera */
  const pickCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      alert("Camera permission is required!");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setCameraFile({
        uri: result.assets[0].uri,
        name: result.assets[0].uri.split("/").pop(),
        type: "image/jpeg",
      });
    }
  };

  /** Render chat message */
  const renderItem: ListRenderItem<Message> = ({ item }) => (
    <ThemedView
      style={[
        styles.messageBubble,
        item.sender === "user" ? styles.userMessage : styles.botMessage,
      ]}
    >
      {item.text && (
        <ThemedText
          style={[styles.messageText, item.sender === "user" && styles.userText]}
        >
          {item.text}
        </ThemedText>
      )}

      {item.imageUri && (
        <Image source={{ uri: item.imageUri }} style={styles.imagePreview} />
      )}

      {item.audioUri && (
        <TouchableOpacity
          onPress={() => playAudio(item.audioUri!)}
          style={[
            styles.audioPlayButton,
            item.sender === "user" && { backgroundColor: "#0056b3" }
          ]}
        >
          <IconSymbol name="play.fill" size={16} color="white" />
          <Text style={{ color: "white", marginLeft: 5 }}>Play Audio</Text>
        </TouchableOpacity>
      )}
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContainer}
        renderItem={renderItem}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ThemedView style={styles.inputContainer}>
          {/* Show recorded audio preview if exists */}
          {audioFile && (
            <TouchableOpacity 
              onPress={() => playAudio(audioFile.uri)} 
              style={styles.audioPreview}
            >
              <IconSymbol name="play.fill" size={16} color="white" />
              <Text style={{ color: "white", marginLeft: 5 }}>Play Recording</Text>
            </TouchableOpacity>
          )}

          {/* Show image preview if exists */}
          {imageFile && (
            <Image source={{ uri: imageFile.uri }} style={styles.smallImagePreview} />
          )}

          {/* Show camera image preview if exists */}
          {cameraFile && (
            <Image source={{ uri: cameraFile.uri }} style={styles.smallImagePreview} />
          )}

          <TouchableOpacity onPress={toggleRecording} style={styles.iconButton}>
            <IconSymbol
              name={isRecording ? "house.fill" : "paperplane.fill"}
              size={24}
              color={isRecording ? "red" : "#FF3B30"}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={pickImage} style={styles.iconButton}>
            <IconSymbol name="house.fill" size={24} color="#007AFF" />
          </TouchableOpacity>

          <TouchableOpacity onPress={pickCamera} style={styles.iconButton}>
            <IconSymbol name="house.fill" size={24} color="#26db12" />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={sendMessage}
          />

          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <IconSymbol name="paperplane.fill" size={24} color="#007AFF" />
          </TouchableOpacity>
        </ThemedView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 30 },
  messagesContainer: { padding: 20 },
  messageBubble: {
    maxWidth: "80%",
    padding: 10,
    borderRadius: 12,
    marginVertical: 5,
  },
  userMessage: { backgroundColor: "#007AFF", alignSelf: "flex-end" },
  botMessage: { backgroundColor: "#E5E5EA", alignSelf: "flex-start" },
  messageText: { color: "#000" },
  userText: { color: "#fff" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderTopColor: "#ccc",
    borderTopWidth: 1,
    backgroundColor: "#fff",
    flexWrap: "wrap",
  },
  textInput: {
    flex: 1,
    padding: 10,
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    marginRight: 10,
    minWidth: 100,
  },
  sendButton: { padding: 10 },
  iconButton: { padding: 10 },
  imagePreview: {
    width: 200,
    height: 200,
    marginTop: 5,
    borderRadius: 10,
  },
  smallImagePreview: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 8,
  },
  audioPlayButton: {
    backgroundColor: "#007AFF",
    padding: 8,
    borderRadius: 8,
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  audioPreview: {
    backgroundColor: "#007AFF",
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
  },
});