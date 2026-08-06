/**
 * SafeLayout Components
 * 
 * Usage Guideline:
 * - Use `SafeScrollView` for scrollable screen content (forms, detail views, settings).
 * - Use `FixedBottomBar` for sticky/fixed bottom action buttons or footer bars.
 * - Both components automatically handle Android's edge-to-edge system navigation bar spacing — 
 *   do not manually add `insets.bottom` padding elsewhere when using these wrappers.
 */

import React from 'react';
import { ScrollView, ScrollViewProps, View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface SafeScrollViewProps extends ScrollViewProps {
  baseBottomPadding?: number;
}

/**
 * ScrollView wrapper that automatically incorporates `insets.bottom`
 * into `contentContainerStyle`.
 */
export function SafeScrollView({
  children,
  contentContainerStyle,
  baseBottomPadding = 20,
  ...props
}: SafeScrollViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      {...props}
      contentContainerStyle={[
        contentContainerStyle,
        { paddingBottom: baseBottomPadding + insets.bottom }
      ]}
    >
      {children}
    </ScrollView>
  );
}

export interface FixedBottomBarProps extends ViewProps {
  basePadding?: number;
}

/**
 * Container wrapper for fixed/sticky bottom action buttons that
 * automatically incorporates `insets.bottom` into `paddingBottom`.
 */
export function FixedBottomBar({
  children,
  style,
  basePadding = 16,
  ...props
}: FixedBottomBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      {...props}
      style={[
        style,
        { paddingBottom: basePadding + insets.bottom }
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Custom hook to calculate total bottom padding (base + insets.bottom).
 * Use this for FlatList contentContainerStyle or KeyboardAwareScrollView where SafeScrollView cannot be used directly.
 */
export function useBottomPadding(basePadding = 20): number {
  const insets = useSafeAreaInsets();
  return basePadding + insets.bottom;
}

