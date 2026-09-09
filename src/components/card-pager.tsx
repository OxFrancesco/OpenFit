import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialIcon } from './material-icon';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';

const PAGE_HEIGHT = 80;
export type CardPage = { id: string; value: ReactNode; detail?: string };

export function CardPager({ pages, label }: { pages: CardPage[]; label: string }) {
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const ref = useRef<ScrollView>(null);
  const goTo = (next: number) => {
    const index = Math.max(0, Math.min(pages.length - 1, next));
    setPage(index);
    ref.current?.scrollTo({ y: index * PAGE_HEIGHT, animated: true });
  };
  return (
    <View style={styles.row}>
      <ScrollView
        ref={ref}
        style={styles.pager}
        pagingEnabled
        nestedScrollEnabled
        scrollEnabled={pages.length > 1}
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={(event) =>
          setPage(
            Math.max(
              0,
              Math.min(
                pages.length - 1,
                Math.round(event.nativeEvent.contentOffset.y / PAGE_HEIGHT)
              )
            )
          )
        }
      >
        {pages.map((item) => (
          <View key={item.id} style={styles.page}>
            {item.value}
            {item.detail ? (
              <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={2}>
                {item.detail}
              </ThemedText>
            ) : null}
          </View>
        ))}
      </ScrollView>
      {pages.length > 1 ? (
        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Previous ${label}`}
            disabled={page === 0}
            hitSlop={4}
            onPress={() => goTo(page - 1)}
            style={[styles.arrow, page === 0 && styles.disabled]}
          >
            <MaterialIcon name="keyboard-arrow-up" size={20} color={theme.textSecondary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Next ${label}`}
            disabled={page === pages.length - 1}
            hitSlop={4}
            onPress={() => goTo(page + 1)}
            style={[styles.arrow, page === pages.length - 1 && styles.disabled]}
          >
            <MaterialIcon name="keyboard-arrow-down" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pager: { height: PAGE_HEIGHT, flexGrow: 1, flexShrink: 1 },
  page: { height: PAGE_HEIGHT, justifyContent: 'center', gap: 4 },
  controls: { justifyContent: 'center' },
  arrow: {
    width: 28,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.25 },
});
