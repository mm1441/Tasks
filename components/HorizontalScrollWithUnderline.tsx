import React, { useRef, useState, useEffect, FC } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { TaskList } from '../types/TaskList';

const { width } = Dimensions.get('window');
const ITEM_SPACING = 12;
const ITEM_WIDTH = (width - 2 * ITEM_SPACING) / 3;
const SNAP_INTERVAL = ITEM_WIDTH + ITEM_SPACING;
const SIDE_PADDING = (width - ITEM_WIDTH) / 2;

interface Props {
  taskLists: TaskList[];
  selectedIndex?: number;
  onActiveChange?: (index: number) => void;
}

const HorizontalScrollWithUnderline: FC<Props> = ({taskLists, selectedIndex, onActiveChange}) => {
  const listRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    typeof selectedIndex === 'number' && selectedIndex >= 0 ? selectedIndex : 0
  );
  // whether FlatList has layouted (safe to scroll)
  const [listReady, setListReady] = useState(false);

  // notify parent when active index changes (only for valid numeric indices)
  useEffect(() => {
    if (typeof activeIndex === 'number') {
      onActiveChange?.(activeIndex);
    }
  }, [activeIndex, onActiveChange]);

  // Sync external selectedIndex -> internal activeIndex + scroll to center
  useEffect(() => {
    if (
      typeof selectedIndex !== 'number' ||
      selectedIndex < 0 ||
      selectedIndex >= taskLists.length
    ) {
      return;
    }

    if (selectedIndex === activeIndex) {
      // still attempt to scroll if list wasn't ready previously
      if (!listReady) {
        // fall through to scroll attempt below
      } else {
        return; // nothing to do
      }
    }

    // update internal state so underline/highlight changes
    setActiveIndex(selectedIndex);

    // scroll when list is ready. If not ready yet, wait for onLayout to trigger.
    const doScroll = () => {
      try {
        // prefer scrollToIndex with viewPosition to center the item
        listRef.current?.scrollToIndex({
          index: selectedIndex,
          animated: true,
          viewPosition: 0.5, // 0.5 centers the item
        });
      } catch (err) {
        // fallback: compute offset manually (best-effort)
        const fallbackOffset = selectedIndex * SNAP_INTERVAL;
        listRef.current?.scrollToOffset({ offset: fallbackOffset, animated: true });
      }
    };

    if (listReady) {
      // ensure animation frame so FlatList internal refs are ready
      requestAnimationFrame(() => {
        requestAnimationFrame(doScroll);
      });
    }
    // if not ready, the onLayout handler will call doScroll once listReady becomes true
  }, [selectedIndex, taskLists.length, listReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // when user taps an item
  const onPressItem = (index: number) => {
    setActiveIndex(index);
    // center the tapped item
    try {
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
    } catch {
      listRef.current?.scrollToOffset({
        offset: index * SNAP_INTERVAL,
        animated: true,
      });
    }
  };

  // when user scrolls via gestures
  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SNAP_INTERVAL);
    const clamped = Math.max(0, Math.min(index, taskLists.length - 1));
    if (clamped !== activeIndex) setActiveIndex(clamped);
  };

  const getItemLayout = (_: any, index: number) => ({
    length: SNAP_INTERVAL,
    offset: SNAP_INTERVAL * index + SIDE_PADDING,
    index,
  });

  const renderItem = ({ item, index }: { item: TaskList; index: number }) => {
    const isActive = index === activeIndex;
    return (
      <View style={{ width: ITEM_WIDTH, height: '100%', position: 'relative' }}>
        <TouchableOpacity
          style={{
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => onPressItem(index)}
          activeOpacity={0.7}
        >
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={[styles.text, isActive ? styles.activeText : styles.inactiveText]}
          >
            {item.title}
          </Text>
        </TouchableOpacity>
        <View style={[styles.underline, isActive && styles.underlineActive]} />
      </View>
    );
  };

  // Called when FlatList container gets its layout — flag list as ready and attempt a scroll to selectedIndex
  const handleListLayout = () => {
    if (!listReady) {
      setListReady(true);
      // after layout, ensure selectedIndex is scrolled into view
      if (typeof selectedIndex === 'number' && selectedIndex >= 0 && selectedIndex < taskLists.length) {
        // double RAF to be extra safe
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              listRef.current?.scrollToIndex({
                index: selectedIndex,
                animated: false,
                viewPosition: 0.5,
              });
            } catch {
              listRef.current?.scrollToOffset({
                offset: selectedIndex * SNAP_INTERVAL,
                animated: false,
              });
            }
          });
        });
      }
    }
  };

  return (
    <View style={styles.wrapper}>
      <FlatList
        ref={listRef}
        data={taskLists}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderItem}
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.98}
        contentContainerStyle={{ paddingHorizontal: SIDE_PADDING }}
        ItemSeparatorComponent={() => <View style={{ width: ITEM_SPACING }} />}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={getItemLayout}
        onLayout={handleListLayout} // <-- ensures we only attempt to scroll after layout
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    height: 56,
    justifyContent: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#0b6efd',
    backgroundColor: '#FFF',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeText: { color: '#0b6efd' },
  inactiveText: { color: '#666' },
  underline: {
    position: 'absolute',
    left: 0,
    bottom: -1.5,
    height: 4,
    width: 0,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  underlineActive: {
    width: ITEM_WIDTH,
    backgroundColor: '#0b6efd',
  },
});

export default HorizontalScrollWithUnderline;
