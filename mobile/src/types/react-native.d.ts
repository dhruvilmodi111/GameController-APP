declare module 'react-native' {
  import * as React from 'react';

  export interface ViewStyle {
    [key: string]: any;
  }
  export interface TextStyle {
    [key: string]: any;
  }
  export interface ImageStyle {
    [key: string]: any;
  }

  export type StyleProp<T> = T | Array<T | undefined | null | false> | undefined | null | false;

  export interface ViewProps {
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
    [key: string]: any;
  }

  export interface TextProps {
    style?: StyleProp<TextStyle>;
    children?: React.ReactNode;
    numberOfLines?: number;
    [key: string]: any;
  }

  export interface TouchableOpacityProps extends ViewProps {
    onPress?: () => void;
    onPressIn?: () => void;
    onPressOut?: () => void;
    activeOpacity?: number;
    disabled?: boolean;
  }

  export interface TextInputProps extends ViewProps {
    value?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
    placeholderTextColor?: string;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    autoCorrect?: boolean;
    keyboardType?: 'default' | 'numeric' | 'email-address' | 'url';
    maxLength?: number;
    editable?: boolean;
  }

  export interface ModalProps {
    visible?: boolean;
    transparent?: boolean;
    animationType?: 'none' | 'slide' | 'fade';
    onRequestClose?: () => void;
    children?: React.ReactNode;
  }

  export interface StatusBarProps {
    barStyle?: 'default' | 'light-content' | 'dark-content';
    backgroundColor?: string;
    hidden?: boolean;
    translucent?: boolean;
  }

  export interface SwitchProps {
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    disabled?: boolean;
    trackColor?: { false?: string; true?: string };
    thumbColor?: string;
  }

  export interface ActivityIndicatorProps {
    size?: 'small' | 'large' | number;
    color?: string;
    style?: StyleProp<ViewStyle>;
  }

  export const View: React.FC<ViewProps>;
  export const Text: React.FC<TextProps>;
  export const TouchableOpacity: React.FC<TouchableOpacityProps>;
  export const TouchableWithoutFeedback: React.FC<TouchableOpacityProps>;
  export const TextInput: React.FC<TextInputProps>;
  export const Modal: React.FC<ModalProps>;
  export const ScrollView: React.FC<ViewProps & { contentContainerStyle?: StyleProp<ViewStyle>; keyboardShouldPersistTaps?: string }>;
  export const StatusBar: React.FC<StatusBarProps>;
  export const SafeAreaView: React.FC<ViewProps>;
  export const Switch: React.FC<SwitchProps>;
  export const ActivityIndicator: React.FC<ActivityIndicatorProps>;

  export namespace StyleSheet {
    export function create<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(styles: T): T;
  }

  export namespace Dimensions {
    export function get(dim: 'window' | 'screen'): { width: number; height: number; scale: number; fontScale: number };
    export function addEventListener(type: string, handler: (dims: any) => void): { remove: () => void };
  }

  export namespace Platform {
    export const OS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
    export const Version: number | string;
    export function select<T>(specifics: { [platform in 'ios' | 'android' | 'default']?: T }): T;
  }

  export namespace Vibration {
    export function vibrate(pattern?: number | number[], repeat?: boolean): void;
    export function cancel(): void;
  }

  export namespace Animated {
    export class Value {
      constructor(val: number);
      setValue(val: number): void;
      interpolate(config: any): any;
    }
    export function timing(val: Value, config: any): { start: (callback?: () => void) => void; stop: () => void };
    export function spring(val: Value, config: any): { start: (callback?: () => void) => void; stop: () => void };
    export const View: React.FC<ViewProps>;
    export const Text: React.FC<TextProps>;
  }
}
