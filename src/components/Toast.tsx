/**
 * Komponen Toast ringan (tanpa dependency pihak ketiga).
 * Muncul di bagian atas layar, auto-hide setelah 2.5 detik.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, RADII, SPACING } from '../../constants/theme';

type ToastType = 'success' | 'error' | 'info';

interface ToastData {
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const TOAST_CONTEXT = createContext<ToastContextValue | undefined>(undefined);

const TOAST_CONFIG: Record<
  ToastType,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  success: { icon: 'checkmark-circle', color: COLORS.success },
  error: { icon: 'alert-circle', color: COLORS.danger },
  info: { icon: 'information-circle', color: COLORS.info },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);

      setToast({ message, type });
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
      }).start();

      hideTimeout.current = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -100,
          duration: 250,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 2500);
    },
    [translateY]
  );

  return (
    <TOAST_CONTEXT.Provider value={{ showToast }}>
      {children}
      <Animated.View
        style={[styles.container, { transform: [{ translateY }] }]}
        pointerEvents="none"
      >
        {toast ? (
          <View style={styles.toast}>
            <Ionicons
              name={TOAST_CONFIG[toast.type].icon}
              size={20}
              color={TOAST_CONFIG[toast.type].color}
            />
            <Text style={styles.message} numberOfLines={3}>
              {toast.message}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </TOAST_CONTEXT.Provider>
  );
}

/** Hook untuk menampilkan toast dari komponen mana pun */
export function useToast(): ToastContextValue {
  const context = useContext(TOAST_CONTEXT);
  if (!context) {
    throw new Error('useToast harus dipakai di dalam <ToastProvider>');
  }
  return context;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xxl + 20,
    marginHorizontal: SPACING.lg,
    maxWidth: '92%',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  message: {
    flexShrink: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    marginLeft: SPACING.sm,
  },
});
