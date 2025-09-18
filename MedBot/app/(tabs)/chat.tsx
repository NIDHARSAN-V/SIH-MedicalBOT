import { useState, useRef, useEffect } from "react";
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
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
  useColorScheme,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Ionicons, MaterialIcons, FontAwesome, Feather } from '@expo/vector-icons';

type Message = {
  id: string;
  text?: string;
  sender: "user" | "bot";
  imageUri?: string;
  audioUri?: string;
};

// Your server URL - change this to your actual server IP
const SERVER_URL = "http://10.84.85.98:5000"; // Replace with your computer's IP

export default function Chat() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inputWrapperMargin, setInputWrapperMargin] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", text: "Hello! How can I assist you today?", sender: "bot" },
  ]);
  const [inputText, setInputText] = useState<string>("");
  const [audioFile, setAudioFile] = useState<any>(null);
  const [imageFile, setImageFile] = useState<any>(null);
  const [cameraFile, setCameraFile] = useState<any>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setKeyboardVisible(true);
        setInputWrapperMargin(e.endCoordinates.height);
        // Scroll to bottom when keyboard appears
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setKeyboardVisible(false);
        setInputWrapperMargin(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Scroll to bottom when new messages are added or keyboard appears
  useEffect(() => {
    if (messages.length > 0 || keyboardVisible) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, keyboardVisible]);

  // Pulse animation for recording
  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

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
        stopPulse();
      } else {
        // Dismiss keyboard when starting to record
        Keyboard.dismiss();
        
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
        startPulse();
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

  /** Send message to Flask backend */
  const sendMessage = async () => {
    if (!inputText.trim() && !audioFile && !imageFile && !cameraFile) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: "user",
      imageUri: imageFile?.uri || cameraFile?.uri,
      audioUri: audioFile?.uri,
    };
    
    // Animation for new message
    slideAnim.setValue(50);
    fadeAnim.setValue(0);
    
    setMessages((prev) => [...prev, newMessage]);
    setInputText("");

    // Dismiss keyboard after sending
    Keyboard.dismiss();

    setIsLoading(true);

    try {
      // Create form data to send to Flask
      const formData = new FormData();
      
      if (inputText.trim()) {
        formData.append('query_text', inputText.trim());
      }
      
      if (audioFile) {
        formData.append('audio', {
          uri: audioFile.uri,
          name: audioFile.name || 'recording.m4a',
          type: audioFile.mimeType || 'audio/m4a'
        } as any);
      }
      
      // Only send one image (priority: camera image over gallery image)
      const imageToSend = cameraFile || imageFile;
      if (imageToSend) {
        formData.append('image', {
          uri: imageToSend.uri,
          name: imageToSend.name || 'image.jpg',
          type: imageToSend.type || 'image/jpeg'
        } as any);
      }

      // Send request to Flask backend
      const response = await fetch(`${SERVER_URL}/process`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      // Create bot message with response from Flask
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.doctor_response || "I'm not sure how to respond to that.",
        sender: "bot",
      };

      // If there's an audio response from the doctor, add it to the message
      if (data.voice_of_doctor) {
        botMessage.audioUri = `${SERVER_URL}${data.voice_of_doctor}`;
      }

      setMessages((prev) => [...prev, botMessage]);

      // Animate in the new message
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();

    } catch (error) {
      console.error("Error sending message to server:", error);
      
      // Fallback message if server is unavailable
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting to the server. Please try again later.",
        sender: "bot",
      };
      
      setMessages((prev) => [...prev, errorMessage]);
      
      Alert.alert("Error", "Could not connect to the server. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
      
      // Reset files
      setAudioFile(null);
      setImageFile(null);
      setCameraFile(null);
    }
  };

  /** Pick image from gallery */
  const pickImage = async () => {
    // Dismiss keyboard when picking image
    Keyboard.dismiss();
    
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
    // Dismiss keyboard when using camera
    Keyboard.dismiss();
    
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
  const renderItem: ListRenderItem<Message> = ({ item, index }) => {
    const isFirstMessage = index === 0;
    
    return (
      <Animated.View
        style={[
          styles.messageBubble,
          item.sender === "user" 
            ? [styles.userMessage, isDarkMode && styles.userMessageDark] 
            : [styles.botMessage, isDarkMode && styles.botMessageDark],
          isFirstMessage && {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {item.text && (
          <ThemedText
            style={[
              styles.messageText, 
              item.sender === "user" && styles.userText,
              isDarkMode && item.sender === "bot" && styles.botTextDark
            ]}
          >
            {item.text}
          </ThemedText>
        )}

        {item.imageUri && (
          <Image 
            source={{ uri: item.imageUri }} 
            style={[
              styles.imagePreview,
              { maxWidth: Dimensions.get('window').width * 0.6 }
            ]} 
            resizeMode="contain"
          />
        )}

        {item.audioUri && (
          <TouchableOpacity
            onPress={() => playAudio(item.audioUri!)}
            style={[
              styles.audioPlayButton,
              item.sender === "user" 
                ? { backgroundColor: isDarkMode ? "#1E88E5" : "#0056b3" }
                : { backgroundColor: isDarkMode ? "#424242" : "#e0e0e0" }
            ]}
          >
            <Ionicons name="play" size={16} color={item.sender === "user" ? "white" : (isDarkMode ? "white" : "black")} />
            <Text style={{ 
              color: item.sender === "user" ? "white" : (isDarkMode ? "white" : "black"), 
              marginLeft: 5,
              fontSize: 14,
            }}>
              Play Audio
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  return (
    <ThemedView style={[styles.container, isDarkMode && styles.containerDark]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.flexContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.messagesContainer,
              { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 80 : 20 }
            ]}
            renderItem={renderItem}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            style={[styles.keyboardAvoidingView, { marginBottom: keyboardHeight > 0 ? 0 : 0 }]}
          >
            <ThemedView style={[styles.inputContainer, isDarkMode && styles.inputContainerDark]}>
              {/* Preview row for attachments */}
              {(audioFile || imageFile || cameraFile) && (
                <View style={styles.previewRow}>
                  {/* Show recorded audio preview if exists */}
                  {audioFile && (
                    <Animated.View 
                      style={[styles.audioPreview, isDarkMode && styles.audioPreviewDark, { opacity: fadeAnim }]}
                    >
                      <TouchableOpacity onPress={() => playAudio(audioFile.uri)}>
                        <Ionicons name="play-circle" size={24} color={isDarkMode ? "#64B5F6" : "#007AFF"} />
                      </TouchableOpacity>
                      <Text style={[styles.previewText, isDarkMode && styles.previewTextDark]}>
                        Audio ready
                      </Text>
                      <TouchableOpacity 
                        onPress={() => setAudioFile(null)}
                        style={styles.removeButton}
                      >
                        <Ionicons name="close-circle" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </Animated.View>
                  )}

                  {/* Show image preview if exists */}
                  {(imageFile || cameraFile) && (
                    <Animated.View style={[styles.imagePreviewContainer, { opacity: fadeAnim }]}>
                      <Image 
                        source={{ uri: (cameraFile || imageFile).uri }} 
                        style={styles.smallImagePreview} 
                      />
                      <TouchableOpacity 
                        onPress={() => {
                          setImageFile(null);
                          setCameraFile(null);
                        }}
                        style={styles.removeImageButton}
                      >
                        <Ionicons name="close-circle" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </Animated.View>
                  )}
                </View>
              )}

              <View style={styles.actionsContainer}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity 
                    onPress={toggleRecording} 
                    style={[
                      styles.iconButton, 
                      isDarkMode && styles.iconButtonDark,
                      isRecording && styles.recordingButton
                    ]}
                  >
                    {isRecording ? (
                      <FontAwesome name="stop" size={20} color="white" />
                    ) : (
                      <FontAwesome name="microphone" size={20} color="#FF3B30" />
                    )}
                  </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity 
                  onPress={pickImage} 
                  style={[styles.iconButton, isDarkMode && styles.iconButtonDark]}
                >
                  <Ionicons name="image" size={24} color={isDarkMode ? "#64B5F6" : "#007AFF"} />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={pickCamera} 
                  style={[styles.iconButton, isDarkMode && styles.iconButtonDark]}
                >
                  <Ionicons name="camera" size={24} color={isDarkMode ? "#81C784" : "#26db12"} />
                </TouchableOpacity>
              </View>

              <View style={[
                styles.inputWrapper, 
                isDarkMode && styles.inputWrapperDark,
                { marginBottom: inputWrapperMargin }
              ]}>
                <TextInput
                  style={[styles.textInput, isDarkMode && styles.textInputDark]}
                  placeholder="Type a message..."
                  placeholderTextColor={isDarkMode ? "#9E9E9E" : "#999"}
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={sendMessage}
                  editable={!isLoading}
                  multiline
                  maxLength={500}
                />
                
                <TouchableOpacity 
                  style={[styles.sendButton, isLoading && styles.disabledButton]} 
                  onPress={sendMessage}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={isDarkMode ? "#9E9E9E" : "#999"} />
                  ) : (
                    <Ionicons name="send" size={24} color={isDarkMode ? "#64B5F6" : "#007AFF"} />
                  )}
                </TouchableOpacity>
              </View>
            </ThemedView>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  flexContainer: {
    flex: 1,
  },
  containerDark: {
    backgroundColor: '#121212'
  },
  messagesContainer: { 
    padding: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 18,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userMessage: { 
    backgroundColor: "#007AFF", 
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  userMessageDark: {
    backgroundColor: "#1E88E5",
  },
  botMessage: { 
    backgroundColor: "#FFFFFF", 
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  botMessageDark: {
    backgroundColor: "#2D2D2D",
  },
  messageText: { 
    color: "#000",
    fontSize: 16,
    lineHeight: 22,
  },
  botTextDark: {
    color: "#FFFFFF",
  },
  userText: { 
    color: "#fff",
    fontSize: 16,
    lineHeight: 22,
  },
  inputContainer: {
    padding: 12,
    borderTopColor: "#e0e0e0",
    borderTopWidth: 1,
    backgroundColor: "#fff",
  },
  inputContainerDark: {
    borderTopColor: "#424242",
    backgroundColor: "#1E1E1E",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    borderRadius: 24,
    paddingHorizontal: 12,
    marginTop: 8,
    minHeight: 50,
  },
  inputWrapperDark: {
    backgroundColor: "#2D2D2D",
  },
  textInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    fontSize: 16,
    maxHeight: 100,
    color: "#000",
  },
  textInputDark: {
    color: "#FFFFFF",
  },
  sendButton: { 
    padding: 8,
  },
  disabledButton: { 
    opacity: 0.5 
  },
  iconButton: { 
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 4,
  },
  iconButtonDark: {
    backgroundColor: '#2D2D2D',
  },
  recordingButton: {
    backgroundColor: '#FF3B30',
  },
  imagePreview: {
    height: 200,
    marginTop: 8,
    borderRadius: 12,
  },
  smallImagePreview: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  audioPlayButton: {
    padding: 10,
    borderRadius: 20,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'center',
  },
  audioPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: '#e6f2ff',
    padding: 8,
    borderRadius: 16,
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  audioPreviewDark: {
    backgroundColor: '#1A237E',
  },
  removeButton: {
    marginLeft: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  keyboardAvoidingView: {
    flex: 0,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#333',
  },
  previewTextDark: {
    color: '#FFF',
  },
});