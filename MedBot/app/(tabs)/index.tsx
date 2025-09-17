import { ScrollView, StyleSheet, Text, View, Image, Animated } from 'react-native';
import { useEffect, useRef } from 'react';

export default function HomeScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Animated.View style={{ ...styles.header, opacity: fadeAnim }}>
        <Text style={styles.title}>Welcome to MediBot</Text>
        <Text style={styles.subtitle}>Your Personal Health Companion</Text>
      </Animated.View>

      <View style={styles.featureContainer}>
        <Image source={require('@/assets/images/chatbot.png')} style={styles.icon} />
        <Text style={styles.featureTitle}>Chatbot Assistant</Text>
        <Text style={styles.featureDesc}>
          Get instant health advice and answers to your queries.
        </Text>
      </View>

      <View style={styles.featureContainer}>
        <Image source={require('@/assets/images/disease.png')} style={styles.icon} />
        <Text style={styles.featureTitle}>Disease Spread Nearby</Text>
        <Text style={styles.featureDesc}>
          Stay informed about outbreaks in your area with real-time updates.
        </Text>
      </View>

      <View style={styles.featureContainer}>
        <Image source={require('@/assets/images/records.png')} style={styles.icon} />
        <Text style={styles.featureTitle}>Health Records</Text>
        <Text style={styles.featureDesc}>
          Upload and manage your medical documents easily.
        </Text>
      </View>

      <View style={styles.featureContainer}>
        <Image source={require('@/assets/images/reminder.png')} style={styles.icon} />
        <Text style={styles.featureTitle}>Medication Reminders</Text>
        <Text style={styles.featureDesc}>
          Set alerts and never miss your medications or appointments.
        </Text>
      </View>

      <View style={styles.featureContainer}>
        <Image source={require('@/assets/images/emergency.png')} style={styles.icon} />
        <Text style={styles.featureTitle}>Emergency Contacts</Text>
        <Text style={styles.featureDesc}>
          Connect to nearby hospitals and healthcare services instantly.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#121212',  // Dark background
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',  // White text
  },
  subtitle: {
    fontSize: 18,
    color: '#ccc',  // Lighter grey for subtitle
    textAlign: 'center',
    marginTop: 8,
  },
  featureContainer: {
    backgroundColor: '#1E1E1E',  // Dark card background
    padding: 15,
    marginVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 10,
    color: '#fff',  // White text
  },
  featureDesc: {
    fontSize: 16,
    color: '#aaa',  // Greyish text for readability
    marginTop: 6,
  },
  icon: {
    width: 60,
    height: 60,
    alignSelf: 'center',
  },
});
