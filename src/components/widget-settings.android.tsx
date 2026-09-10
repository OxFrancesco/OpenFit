import { supportsHealthMetric } from '@/lib/supported-health-metrics';
import { useCallback, useEffect, useState } from "react";
import {
  BackHandler,
  FlatList,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Button,
  Dialog,
  List,
  Portal,
  RadioButton,
  Searchbar,
  SegmentedButtons,
  Text,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WidgetPreview, type WidgetInfo } from "react-native-android-widget";
import { useTheme } from "@/hooks/use-theme";
import { METRIC_CATALOG, getMetricDef } from "@/lib/metric-catalog";
import type { WidgetData } from "@/lib/widget-data";
import { loadLastWidgetData } from "@/lib/widget-store";
import {
  WIDGET_BACKGROUNDS,
  WIDGET_BACKGROUND_LABELS,
} from "@/widgets/android/widget-appearance";
import {
  loadWidgetPreferences,
  saveWidgetPreferences,
  type WidgetPreferences,
} from "@/widgets/android/widget-preferences";
import {
  getAndroidWidgets,
  renderAndroidWidget,
  updateAndroidWidget,
  widgetMetricCount,
} from "@/widgets/android/sync";
import { refreshWidgetMetrics } from "@/widgets/android/refresh-data";

type EditorState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      info: WidgetInfo;
      prefs: WidgetPreferences;
      data: WidgetData | null;
    };

export default function WidgetSettingsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [state, setState] = useState<EditorState>({ kind: "loading" });
  const [slot, setSlot] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const widgetId = Number(id);
      const widgets = await getAndroidWidgets();
      const info = widgets.find(
        (widget) => Number.isInteger(widgetId) && widget.widgetId === widgetId,
      );
      if (!info)
        throw new Error(
          "This widget is no longer on your home screen. Open the pencil on a widget to edit it.",
        );
      const [prefs, data] = await Promise.all([
        loadWidgetPreferences(widgetId),
        loadLastWidgetData(),
      ]);
      if (cancelled) return;
      setState({ kind: "ready", info, prefs, data });
      try {
        const fresh = await refreshWidgetMetrics(
          prefs.metrics.slice(0, widgetMetricCount(info.widgetName)),
        );
        if (!cancelled && fresh)
          setState((current) =>
            current.kind === "ready" ? { ...current, data: fresh } : current,
          );
      } catch {
        // Editing remains available offline, using the last saved values.
      }
    }
    load().catch((error: unknown) => {
      if (!cancelled)
        setState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not open this widget.",
        });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const preview = useCallback(
    (size: { width: number; height: number }) => {
      if (state.kind !== "ready") return <View />;
      return renderAndroidWidget(
        { ...state.info, ...size },
        state.data,
        state.prefs,
      );
    },
    [state],
  );

  function setPreferences(prefs: WidgetPreferences) {
    setState((current) =>
      current.kind === "ready" ? { ...current, prefs } : current,
    );
    setSaveError(null);
  }

  async function save() {
    if (state.kind !== "ready" || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveWidgetPreferences(state.info.widgetId, state.prefs);
      await updateAndroidWidget(state.info, await loadLastWidgetData());
      refreshWidgetMetrics(
        state.prefs.metrics.slice(0, widgetMetricCount(state.info.widgetName)),
      )
        .then((data) => updateAndroidWidget(state.info, data))
        .catch(() => undefined);
      BackHandler.exitApp();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Could not save this widget. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (state.kind !== "ready")
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Edit widget" }} />
        {state.kind === "loading" ? (
          <ActivityIndicator />
        ) : (
          <Text>{state.message}</Text>
        )}
      </View>
    );

  const { prefs, info } = state;
  const count = widgetMetricCount(info.widgetName);
  const previewWidth = Math.min(info.width, width - 64);
  const previewHeight = Math.min(info.height, 220);
  const metrics = METRIC_CATALOG.filter(metric => supportsHealthMetric(metric.id)).filter((metric) =>
    `${metric.label} ${metric.category}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "Edit widget" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.preview,
            {
              backgroundColor:
                prefs.background === "transparent"
                  ? prefs.textTone === "light"
                    ? "#26352C"
                    : "#E9E1CF"
                  : theme.background,
            },
          ]}
        >
          <WidgetPreview
            width={previewWidth}
            height={previewHeight}
            renderWidget={preview}
          />
        </View>
        {prefs.metrics.slice(0, count).map((metric, index) => (
          <List.Item
            key={index}
            title={["First value", "Second value", "Third value"][index]}
            description={getMetricDef(metric)?.label ?? metric}
            descriptionNumberOfLines={2}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {
              setSearch("");
              setSlot(index);
            }}
            accessibilityLabel={`Choose ${["first", "second", "third"][index]} value: ${getMetricDef(metric)?.label ?? metric}`}
            style={styles.metric}
          />
        ))}
        <Text variant="titleMedium" style={styles.label}>
          Background
        </Text>
        {WIDGET_BACKGROUNDS.map((background) => (
          <RadioButton.Item
            key={background}
            label={WIDGET_BACKGROUND_LABELS[background]}
            value={background}
            status={prefs.background === background ? "checked" : "unchecked"}
            onPress={() => setPreferences({ ...prefs, background })}
            style={styles.option}
          />
        ))}
        {prefs.background === "transparent" ? (
          <View style={styles.textTone}>
            <Text variant="titleMedium">Text color</Text>
            <SegmentedButtons
              value={prefs.textTone ?? "dark"}
              onValueChange={(value) =>
                setPreferences({
                  ...prefs,
                  textTone: value === "light" ? "light" : "dark",
                })
              }
              buttons={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
              ]}
            />
          </View>
        ) : null}
      </ScrollView>
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: theme.background,
          },
        ]}
      >
        {saveError ? (
          <Text accessibilityRole="alert" style={{ color: theme.error }}>
            {saveError}
          </Text>
        ) : null}
        <Button
          mode="contained"
          onPress={save}
          loading={saving}
          disabled={saving}
          contentStyle={styles.done}
        >
          Done
        </Button>
      </View>
      <Portal>
        <Dialog
          visible={slot !== null}
          onDismiss={() => setSlot(null)}
          style={styles.dialog}
        >
          <Dialog.Title>Choose metric</Dialog.Title>
          <Dialog.Content>
            <Searchbar
              placeholder="Search metrics"
              value={search}
              onChangeText={setSearch}
            />
          </Dialog.Content>
          <Dialog.ScrollArea style={styles.metricList}>
            <FlatList
              data={metrics}
              keyExtractor={(metric) => metric.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <RadioButton.Item
                  label={item.label}
                  value={item.id}
                  status={
                    slot !== null && prefs.metrics[slot] === item.id
                      ? "checked"
                      : "unchecked"
                  }
                  style={styles.option}
                  onPress={() => {
                    if (slot === null) return;
                    setPreferences({
                      ...prefs,
                      metrics: prefs.metrics.map((value, index) =>
                        index === slot ? item.id : value,
                      ),
                    });
                    setSlot(null);
                  }}
                />
              )}
            />
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setSlot(null)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  preview: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    padding: 12,
    marginBottom: 16,
  },
  metric: { minHeight: 72 },
  label: { marginTop: 20, marginBottom: 4, paddingHorizontal: 16 },
  option: { minHeight: 56 },
  textTone: { paddingHorizontal: 16, gap: 12, marginTop: 16 },
  footer: {
    padding: 16,
    gap: 12,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  done: { height: 56 },
  dialog: { maxHeight: "85%" },
  metricList: { flexShrink: 1, paddingHorizontal: 0 },
});
