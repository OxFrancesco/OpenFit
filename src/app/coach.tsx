import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingDots } from '@/components/loading';
import { MetricIcon } from '@/components/metric-icon';
import { ThemedText } from '@/components/themed-text';
import { ErrorRed, MaxContentWidth, RingColors, Spacing } from '@/constants/theme';
import { useHealthCoach } from '@/hooks/use-health-coach';
import { useTheme } from '@/hooks/use-theme';
import type { CoachMessage } from '@/lib/coach-api';

const STARTERS = [
  'How am I doing today?',
  'What changed this week?',
  'Review my nutrition data',
  'Help me describe a meal',
];

export default function CoachScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [text, setText] = useState('');
  const { busy, clear, error, loading, messages, recording, send, toggleRecording, transcribing } =
    useHealthCoach();

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [busy, messages]);

  const submit = () => {
    const next = text.trim();
    if (!next) return;
    setText('');
    void send(next);
  };

  const confirmClear = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this coach conversation from every device?')) void clear();
      return;
    }

    Alert.alert('Delete conversation?', 'This removes the coach conversation from every device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void clear() },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Coach',
          headerStyle: { backgroundColor: theme.background },
          headerShadowVisible: false,
          headerTintColor: theme.text,
          headerRight: () =>
            messages.length ? (
              <Pressable accessibilityRole="button" onPress={confirmClear} hitSlop={10}>
                <ThemedText type="smallBold" style={{ color: ErrorRed }}>
                  Delete
                </ThemedText>
              </Pressable>
            ) : null,
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={[
            styles.conversation,
            { paddingBottom: Spacing.four, maxWidth: MaxContentWidth },
          ]}
        >
          {!messages.length && !loading ? <CoachWelcome onSelect={(starter) => void send(starter)} /> : null}

          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}

          {loading || busy ? (
            <Animated.View entering={FadeIn.duration(180)} style={styles.thinkingRow}>
              <CoachMark />
              <View style={[styles.thinkingBubble, { backgroundColor: theme.card }]}>
                <LoadingDots color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {transcribing ? 'Transcribing with ElevenLabs' : loading ? 'Connecting securely' : 'Looking at your data'}
                </ThemedText>
              </View>
            </Animated.View>
          ) : null}

          {error ? (
            <Animated.View entering={FadeInDown.duration(220)} style={[styles.error, { borderColor: ErrorRed }]}>
              <ThemedText selectable type="small" style={{ color: ErrorRed }}>
                {error}
              </ThemedText>
            </Animated.View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.composerArea,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.separator,
              paddingBottom: Math.max(insets.bottom, Spacing.two),
            },
          ]}
        >
          <View style={[styles.composer, { backgroundColor: theme.card, borderColor: theme.separator }]}>
            <TextInput
              accessibilityLabel="Message your health coach"
              editable={!busy && !recording}
              multiline
              maxLength={4000}
              placeholder={recording ? 'Listening…' : 'Ask about your health or describe a meal'}
              placeholderTextColor={theme.textSecondary}
              value={text}
              onChangeText={setText}
              onSubmitEditing={submit}
              blurOnSubmit={false}
              style={[styles.input, { color: theme.text }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={recording ? 'Stop recording' : 'Record a voice nutrition log'}
              disabled={busy && !recording}
              onPress={() => void toggleRecording()}
              style={({ pressed }) => [
                styles.roundButton,
                { backgroundColor: recording ? ErrorRed : theme.backgroundSelected },
                pressed && styles.pressed,
              ]}
            >
              <MetricIcon
                icon={recording ? 'stop.fill' : 'mic.fill'}
                glyph={recording ? '■' : '●'}
                size={18}
                color={recording ? '#FFFFFF' : theme.text}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!text.trim() || busy || recording}
              onPress={submit}
              style={({ pressed }) => [
                styles.roundButton,
                { backgroundColor: text.trim() && !busy ? theme.text : theme.backgroundSelected },
                pressed && styles.pressed,
              ]}
            >
              <MetricIcon
                icon="arrow.up"
                glyph="↑"
                size={18}
                color={text.trim() && !busy ? theme.background : theme.textSecondary}
              />
            </Pressable>
          </View>
          <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: 'center' }}>
            OpenFit is not medical care. Voice notes are transcribed by ElevenLabs.
          </ThemedText>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

function CoachWelcome({ onSelect }: { onSelect: (starter: string) => void }) {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(420)} style={styles.welcome}>
      <CoachMark large />
      <View style={{ gap: Spacing.one, alignItems: 'center' }}>
        <ThemedText type="subtitle">Your data, in plain language</ThemedText>
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary, textAlign: 'center', maxWidth: 360 }}
        >
          Ask about patterns in Google Health, or speak a short nutrition note. Your conversation follows you across devices.
        </ThemedText>
      </View>
      <View style={styles.starters}>
        {STARTERS.map((starter) => (
          <Pressable
            key={starter}
            accessibilityRole="button"
            onPress={() => onSelect(starter)}
            style={({ pressed }) => [
              styles.starter,
              { backgroundColor: theme.card, borderColor: theme.separator },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="smallBold">{starter}</ThemedText>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

function Message({ message }: { message: CoachMessage }) {
  const theme = useTheme();
  const user = message.role === 'user';

  return (
    <Animated.View
      entering={FadeInDown.duration(260)}
      style={[styles.messageRow, user && styles.userMessageRow]}
    >
      {!user ? <CoachMark /> : null}
      <View
        style={[
          styles.message,
          user
            ? { backgroundColor: theme.text }
            : { backgroundColor: theme.card, borderColor: theme.separator, borderWidth: StyleSheet.hairlineWidth },
        ]}
      >
        <ThemedText selectable style={{ color: user ? theme.background : theme.text }}>
          {message.content}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

function CoachMark({ large = false }: { large?: boolean }) {
  const size = large ? 64 : 30;
  return (
    <View
      accessibilityElementsHidden
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: RingColors.steps,
        },
      ]}
    >
      <MetricIcon icon="heart.text.square.fill" glyph="♥" size={large ? 30 : 15} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  conversation: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
    flexGrow: 1,
  },
  welcome: {
    flex: 1,
    minHeight: 430,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.four,
  },
  starters: { width: '100%', gap: Spacing.two },
  starter: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  userMessageRow: { justifyContent: 'flex-end' },
  message: {
    maxWidth: '84%',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  mark: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  error: { borderWidth: 1, borderRadius: 12, borderCurve: 'continuous', padding: Spacing.three },
  composerArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
  },
  composer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: 6,
    paddingLeft: 14,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, minHeight: 40, maxHeight: 120, fontSize: 16, lineHeight: 21, paddingVertical: 9 },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.65, transform: [{ scale: 0.98 }] },
});
