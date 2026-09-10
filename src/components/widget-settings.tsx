import { Stack } from "expo-router";
import { View } from "react-native";
import { Text } from "react-native-paper";

export default function WidgetSettingsScreen() {
  return (
    <View style={{ padding: 24 }}>
      <Stack.Screen options={{ title: "Edit widget" }} />
      <Text>Open the pencil on an Android home-screen widget to edit it.</Text>
    </View>
  );
}
