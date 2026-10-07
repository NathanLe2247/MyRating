import { useState, type ReactNode } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandIcon } from '@/components/brand-icon';
import { BirthDayLength, BirthYearLength } from '@/constants/profile';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type BirthDateFieldsProps = {
  /** 1–12, or null before one is picked. */
  month: number | null;
  day: string;
  year: string;
  onChangeMonth: (month: number) => void;
  onChangeDay: (day: string) => void;
  onChangeYear: (year: string) => void;
};

const copy = en.onboarding.profile.birthDate;
const monthLabel = (month: number) => `${String(month).padStart(2, '0')} - ${copy.months[month - 1]}`;
const digitsOnly = (text: string, max: number) => text.replace(/\D/g, '').slice(0, max);
// 1–12, built once rather than on every render.
const MONTHS = copy.months.map((_, i) => i + 1);

// Labelled box shared by the three parts: small caps label over the value.
function DateBox({ label, flex, children }: { label: string; flex: number; children: ReactNode }) {
  return (
    <View style={[styles.box, { flex }]}>
      <Text style={styles.boxLabel}>{label}</Text>
      {children}
    </View>
  );
}

// Month (picked from a sheet), day, and year as three side-by-side boxes.
export function BirthDateFields({ month, day, year, onChangeMonth, onChangeDay, onChangeYear }: BirthDateFieldsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.monthPressable}
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={copy.selectMonth}>
        <DateBox label={copy.month} flex={1}>
          <View style={[styles.surface, styles.monthValue]}>
            <Text style={[styles.valueText, month === null && styles.placeholder]} numberOfLines={1}>
              {month === null ? copy.monthPlaceholder : monthLabel(month)}
            </Text>
          </View>
        </DateBox>
      </Pressable>

      <DateBox label={copy.day} flex={0.9}>
        <TextInput
          value={day}
          onChangeText={(text) => onChangeDay(digitsOnly(text, BirthDayLength))}
          placeholder={copy.dayPlaceholder}
          placeholderTextColor={Brand.placeholder}
          selectionColor={Brand.lime}
          keyboardType="number-pad"
          autoComplete="birthdate-day"
          accessibilityLabel={copy.day}
          style={[styles.surface, styles.valueText]}
        />
      </DateBox>

      <DateBox label={copy.year} flex={1.1}>
        <TextInput
          value={year}
          onChangeText={(text) => onChangeYear(digitsOnly(text, BirthYearLength))}
          placeholder={copy.yearPlaceholder}
          placeholderTextColor={Brand.placeholder}
          selectionColor={Brand.lime}
          keyboardType="number-pad"
          autoComplete="birthdate-year"
          accessibilityLabel={copy.year}
          style={[styles.surface, styles.valueText]}
        />
      </DateBox>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setPickerOpen(false)} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <Text style={styles.sheetTitle}>{copy.selectMonth}</Text>
          <FlatList
            data={MONTHS}
            keyExtractor={(m) => String(m)}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                accessibilityRole="button"
                accessibilityState={{ selected: item === month }}
                onPress={() => {
                  onChangeMonth(item);
                  setPickerOpen(false);
                }}>
                <Text style={[styles.optionText, item === month && styles.optionSelected]}>{monthLabel(item)}</Text>
                {item === month && <BrandIcon name="check" color={Brand.lime} size={16} />}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const SHEET_MAX_HEIGHT = '60%';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: BrandSizes.gapSnug,
  },
  monthPressable: {
    flex: 1.4,
    flexDirection: 'row',
  },
  box: {
    gap: Spacing.one,
    paddingHorizontal: BrandSizes.gapSnug,
    paddingVertical: Spacing.two,
    borderRadius: BrandSizes.gapSnug,
    backgroundColor: Brand.card,
  },
  boxLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  monthValue: {
    justifyContent: 'center',
  },
  surface: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: Brand.input,
  },
  valueText: {
    fontFamily: BrandFonts.body,
    fontSize: 16,
    color: Brand.text,
    flexShrink: 1,
  },
  placeholder: {
    color: Brand.placeholder,
  },
  scrim: {
    flex: 1,
    backgroundColor: Brand.scrim,
  },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT,
    backgroundColor: Brand.card,
    borderTopLeftRadius: BrandSizes.cardRadius,
    borderTopRightRadius: BrandSizes.cardRadius,
    paddingTop: Spacing.three,
  },
  sheetTitle: {
    fontFamily: BrandFonts.display,
    fontSize: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.text,
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: BrandSizes.gapSnug,
    paddingHorizontal: Spacing.four,
  },
  optionPressed: {
    backgroundColor: Brand.input,
  },
  optionText: {
    fontFamily: BrandFonts.body,
    fontSize: 16,
    color: Brand.text,
  },
  optionSelected: {
    color: Brand.lime,
  },
});
