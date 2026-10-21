/**
 * Emoji picker panel, loaded on demand.
 *
 * `@ferrucc-io/emoji-picker` carries its emoji data in the bundle, so it stays
 * out of the initial payload until a picker is actually opened. The module is
 * imported imperatively rather than through React.lazy because the package
 * exposes a compound component (EmojiPicker.Header, .Input, .Group, .List) and
 * lazy() returns a component without those statics.
 */
import { useEffect, useState } from 'react';

type EmojiPickerModule = typeof import('@ferrucc-io/emoji-picker');

let loading: Promise<EmojiPickerModule> | null = null;
let loaded: EmojiPickerModule | null = null;

export function loadEmojiPicker(): Promise<EmojiPickerModule> {
  loading ??= import('@ferrucc-io/emoji-picker').then((module) => {
    loaded = module;
    return module;
  });
  return loading;
}

interface EmojiPickerPanelProps {
  onSelect: (emoji: string) => void;
}

export function EmojiPickerPanel({ onSelect }: EmojiPickerPanelProps) {
  const [picker, setPicker] = useState<EmojiPickerModule | null>(loaded);

  useEffect(() => {
    if (picker) return;
    let cancelled = false;
    void loadEmojiPicker().then((module) => {
      if (!cancelled) setPicker(module);
    });
    return () => {
      cancelled = true;
    };
  }, [picker]);

  if (!picker) return null;

  const Picker = picker.EmojiPicker;

  return (
    <Picker
      onEmojiSelect={(emoji) => {
        onSelect(emoji);
      }}
      emojisPerRow={12}
      emojiSize={28}
      className="border-none"
    >
      <Picker.Header>
        <Picker.Input
          placeholder="Search emoji..."
          hideIcon
          className="w-full px-2 py-1.5 text-xs rounded-md bg-surface-2 border border-line text-ink-primary placeholder:text-ink-quaternary outline-none focus:ring-1 focus:ring-accent/50 mb-1.5"
        />
      </Picker.Header>
      <Picker.Group>
        <Picker.List containerHeight={220} />
      </Picker.Group>
    </Picker>
  );
}
