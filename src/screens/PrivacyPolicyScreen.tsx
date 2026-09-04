import { useEffect } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from "react-native";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Database from "lucide-react-native/icons/database";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import Smartphone from "lucide-react-native/icons/smartphone";
import type { LucideIcon } from "lucide-react-native";
import { Screen, Title } from "../components";
import { radius, space, useTheme } from "../theme";
import { Text } from "../typography";

const EFFECTIVE_DATE = "September 4, 2026";

type PolicySectionProps = {
  number: string;
  title: string;
  children: React.ReactNode;
};

/**
 * The policy is kept in the app instead of hiding behind a pre-launch URL.
 * Its disclosures mirror the data paths in store.ts, nfc.ts, blocking.ts, and
 * the native Android blocking service.
 */
export default function PrivacyPolicyScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to settings"
          hitSlop={12}
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.2} />
        </Pressable>
        <Title>Privacy policy</Title>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={[styles.effective, { color: colors.textDim }]}>Effective {EFFECTIVE_DATE}</Text>
        <Text style={[styles.intro, { color: colors.text }]}>
          TapIn is an Android focus app. This policy explains the information the app accesses,
          what stays on your device, why each Android permission is used, and the choices you have.
          “TapIn,” “we,” and “us” mean the developer of the TapIn app (package
          com.kupdevs.tapin).
        </Text>

        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.accentWash, borderColor: colors.border },
          ]}
        >
          <View style={[styles.summaryIcon, { backgroundColor: colors.surface }]}>
            <ShieldCheck size={22} color={colors.accent} strokeWidth={2.1} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>The short version</Text>
            <Text style={[styles.paragraph, { color: colors.textDim }]}>
              TapIn is a paid download with every available feature included; it has no in-app
              purchases or subscriptions. TapIn has no user accounts or developer-operated backend.
              It does not contain ads, analytics, or tracking SDKs, and it does not sell personal
              information. App and device activity is processed locally for blocking and Insights.
              Local app data may still be included in Android backup or device-transfer features if
              you enable them.
            </Text>
          </View>
        </View>

        <PolicySection number="1" title="Scope and meaning of “collect”">
          <Paragraph>
            This policy applies to the TapIn Android app. TapIn must access some information on your
            phone to provide its features. Unless stated otherwise, that access and processing happens
            on the phone. The developer does not receive it. When we say TapIn does not “collect” data,
            we mean it is not transmitted from the app to us or to a service acting for us.
          </Paragraph>
        </PolicySection>

        <PolicySection number="2" title="Information TapIn accesses and uses">
          <DataCard icon={Smartphone} title="App activity and screen time">
            With Android Usage Access, TapIn can read which app is in the foreground, foreground-app
            events, and how long apps were used. During a focus session, the foreground service checks
            the current app so it can shield an app you selected. In StudIn, these checks enforce the
            blocklist during Study intervals and stop blocking during Break intervals. When Accessibility
            is enabled, TapIn also receives window-change events and the package name that owns each changed window. It
            does not retrieve the window’s text, controls, taps, passwords, or content. Insights reads
            up to 14 days of Android usage history to calculate daily totals, app-by-app time, charts,
            and trends. Those Android usage records are read when needed and are not uploaded or copied
            into TapIn’s session log.
          </DataCard>

          <DataCard icon={Database} title="Installed apps and your blocklist">
            TapIn reads the names, Android package identifiers, and icons of launchable apps installed
            on the device. This populates the Blocklist and gives readable names and icons in Insights
            and on the blocking shield. Google Play treats an installed-app inventory as personal and
            sensitive information. TapIn stores only the package identifiers you choose for the
            blocklist; it does not upload, sell, or share your installed-app list.
          </DataCard>

          <DataCard icon={Database} title="NFC cards">
            When you deliberately start a card scan, TapIn reads the card’s stable tag identifier
            (UID). Registration reads the card twice to confirm that the UID is stable. TapIn stores the
            UID and the label you give the card, then compares later taps with registered UIDs to start
            or end a TapIn session or to start an entire StudIn cycle. A later NFC tap does not normally
            end a StudIn Study interval. TapIn does not read other card contents and never writes to the card. A
            card UID can be a persistent identifier, so protect access to your unlocked phone.
          </DataCard>

          <DataCard icon={Database} title="Settings and content you create">
            TapIn stores your chosen appearance, onboarding and welcome status, registered-card labels
            and UIDs, selected blocklist, custom shield message, StudIn Study and Break durations and
            round count, active-session mode and timing state,
            completed focus-session summaries, and emergency-unlock month and use count. A
            completed-session summary contains the local calendar date and
            duration—not the apps you opened during that session.
          </DataCard>

          <DataCard icon={Database} title="StudIn schedule and focus time">
            TapIn stores the Study duration, Break duration, round count, and timing needed to recover
            an active StudIn cycle. Completed StudIn summaries count only Study time; Break time is excluded.
          </DataCard>

          <DataCard icon={Smartphone} title="Permission and service status">
            TapIn checks whether Usage Access, Accessibility, display-over-apps access, NFC, and
            notification access are available so it can guide setup and run the features you request.
            It does not create a history of permission changes. While a focus session is active, an
            ongoing Android foreground-service notification keeps blocking reliable.
          </DataCard>
        </PolicySection>

        <PolicySection number="3" title="How Android permissions are used">
          <Bullet title="Usage Access">
            Detects the foreground app during a session and calculates on-device screen-time Insights.
          </Bullet>
          <Bullet title="Accessibility">
            Receives package-level window changes while blocking is active. If a changed window belongs
            to an app on your blocklist, TapIn sends the device Home immediately. StudIn does this during
            Study intervals, not Break intervals. TapIn does not retrieve the window-content tree.
          </Bullet>
          <Bullet title="Display over other apps">
            Places TapIn’s shield over a selected blocked app. The shield may show that app’s name and
            icon and the custom message you saved.
          </Bullet>
          <Bullet title="NFC">
            Reads a card UID only after you arm the scanner. TapIn does not keep the NFC reader open all
            the time.
          </Bullet>
          <Bullet title="Installed-app visibility">
            Lets TapIn show launchable apps and match their package identifiers, labels, and icons for
            Blocklist, Insights, and blocking.
          </Bullet>
          <Bullet title="Notifications and foreground service">
            Shows the ongoing focus-session notification Android requires for reliable background
            blocking.
          </Bullet>
          <Bullet title="Audio">
            Plays TapIn’s bundled interface sound. TapIn does not request microphone access or record
            audio.
          </Bullet>
          <Bullet title="Legacy storage declarations">
            The app framework may declare read and write storage permissions for Android 12 and earlier.
            TapIn does not request those permissions at runtime or use them to browse your photos, media,
            documents, or other personal files.
          </Bullet>
          <Paragraph>
            The Android build includes the Internet permission as part of its application framework,
            but the current TapIn features make no app-initiated network requests. TapIn does not ask for
            location, camera, contacts, SMS, call logs, or microphone access.
          </Paragraph>
        </PolicySection>

        <PolicySection number="4" title="Local storage and retention">
          <Paragraph>
            TapIn stores its data in app-private Android storage using AsyncStorage and SharedPreferences.
            The blocklist, registered cards, preferences, shield message, StudIn schedule, and related state remain until
            you change them, remove them, clear TapIn’s storage, or uninstall the app. Session history is
            limited to the most recent 400 completed sessions; sessions shorter than five seconds are not
            recorded. Emergency-unlock usage is interpreted by local calendar month and resets on the
            first day of the next month.
          </Paragraph>
          <Paragraph>
            Screen-time source records are maintained by Android under Android’s own retention rules;
            TapIn reads a maximum 14-day window for Insights. If Android backup, restore, or device
            transfer is enabled, Android or your device provider may back up and restore TapIn’s local
            app data under your account settings and that provider’s privacy policy. TapIn does not
            operate or receive those backups.
          </Paragraph>
        </PolicySection>

        <PolicySection number="5" title="Sharing, selling, analytics, and ads">
          <Paragraph>
            TapIn does not transmit your blocklist, installed-app list, usage activity, Insights, NFC
            UIDs, session history, shield message, or settings to the developer. We do not sell, rent,
            share, or use that information for advertising, analytics, cross-app tracking, profiling, or
            marketing. The app does not include third-party advertising, analytics, or crash-reporting
            SDKs.
          </Paragraph>
          <Paragraph>
            Google Play, Android, your device manufacturer, and any backup provider may independently
            process information when they distribute the app, provide operating-system services, handle
            diagnostics you enabled, or perform backup and restore. Their processing is governed by
            their own settings and privacy policies, and TapIn does not receive the on-device data listed
            above from them.
          </Paragraph>
          <Paragraph>
            TapIn is sold as a paid Google Play download. Google Play processes the purchase outside
            the TapIn app under Google&apos;s terms and privacy policy. Google may provide the developer
            with purchase, licensing, and financial-reporting information needed to distribute the app
            and administer transactions. TapIn has no in-app purchases or subscriptions, and the app
            does not receive or store your payment-card details.
          </Paragraph>
        </PolicySection>

        <PolicySection number="6" title="Your choices and controls">
          <Bullet title="Permissions">
            Grant or revoke Usage Access, Accessibility, display-over-apps access, NFC, and notifications
            in Android Settings. A feature that needs revoked access will stop working.
          </Bullet>
          <Bullet title="Cards and blocklist">
            Remove registered cards in TapIn’s card manager and add or remove apps from the Blocklist.
          </Bullet>
          <Bullet title="StudIn schedule">
            Choose the Study duration, Break duration, and number of rounds before starting a StudIn cycle.
            Emergency Exit is the only in-app way to end a Study interval early.
          </Bullet>
          <Bullet title="Shield message">
            Edit it in Settings or leave it empty to restore TapIn’s default message.
          </Bullet>
          <Bullet title="Delete local data">
            Use Android Settings to clear TapIn’s storage, or uninstall TapIn. This removes the app’s
            local copy, subject to any Android backup you control. Because we have no account or backend,
            we cannot view, export, or delete the copy on your phone for you.
          </Bullet>
        </PolicySection>

        <PolicySection number="7" title="Security">
          <Paragraph>
            TapIn relies on Android’s app sandbox and app-private storage to limit access by other apps.
            No storage method is guaranteed to be completely secure. Anyone who can unlock your device,
            use device debugging or backup tools, or compromise the operating system may be able to
            access local data. Keep Android updated, use a secure screen lock, and remove card UIDs or
            shield text you no longer want stored.
          </Paragraph>
        </PolicySection>

        <PolicySection number="8" title="Automated operation and legal bases">
          <Paragraph>
            Blocking is an on-device automated function: TapIn compares a foreground or changed-window
            package with the blocklist you chose. When they match during a blocking interval, it returns
            to Home immediately and uses the blocking shield as a fallback. StudIn uses the schedule you
            selected to release restrictions when Study reaches zero, begin Break, and reapply restrictions
            when the next Study begins. It does not make decisions with legal or similarly
            significant effects and does not build an advertising profile. Where data-protection law
            requires a legal basis, this device-local processing is performed at your request to provide
            the app and based on the permissions and choices you control.
          </Paragraph>
        </PolicySection>

        <PolicySection number="9" title="Children’s privacy">
          <Paragraph>
            TapIn is not directed to children under 13, and the developer does not knowingly collect
            personal information from children. Since TapIn has no accounts or backend collection, we do
            not receive a user’s age or the on-device information described in this policy.
          </Paragraph>
        </PolicySection>

        <PolicySection number="10" title="Changes to this policy">
          <Paragraph>
            We may update this policy when TapIn’s features, permissions, or legal obligations change.
            The revised in-app policy will show a new effective date. If a future feature sends data off
            the device, the policy and any required consent will be updated before that processing is
            introduced.
          </Paragraph>
        </PolicySection>

        <PolicySection number="11" title="Contact">
          <Paragraph>
            For privacy questions or requests, contact the TapIn developer using the developer contact
            details shown on TapIn’s Google Play listing. Please do not send an NFC card UID or sensitive
            shield-message text. The app has no server-side user record for us to look up.
          </Paragraph>
        </PolicySection>

        <Text style={[styles.footer, { color: colors.textDim }]}>TapIn · com.kupdevs.tapin</Text>
      </ScrollView>
    </Screen>
  );
}

function PolicySection({ number, title, children }: PolicySectionProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <View style={[styles.number, { backgroundColor: colors.accentWash }]}>
          <Text style={[styles.numberText, { color: colors.accent }]}>{number}</Text>
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.paragraph, { color: colors.textDim }]}>{children}</Text>;
}

function DataCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.dataCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.dataHeading}>
        <Icon size={18} color={colors.accent} strokeWidth={2.1} />
        <Text style={[styles.dataTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <Text style={[styles.paragraph, { color: colors.textDim }]}>{children}</Text>
    </View>
  );
}

function Bullet({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bulletDot, { color: colors.accent }]}>•</Text>
      <Text style={[styles.paragraph, styles.bulletCopy, { color: colors.textDim }]}>
        <Text style={{ color: colors.text, fontWeight: "600" }}>{title}: </Text>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.5),
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingTop: space(1.5),
    paddingBottom: space(5),
  },
  effective: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  intro: {
    marginTop: space(1),
    fontSize: 15,
    lineHeight: 23,
  },
  summaryCard: {
    marginTop: space(2.5),
    padding: space(2),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space(1.5),
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCopy: {
    flex: 1,
    gap: space(0.5),
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  section: {
    marginTop: space(3.5),
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
  },
  number: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sectionTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "600",
  },
  sectionBody: {
    marginTop: space(1.25),
    gap: space(1.25),
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 21,
  },
  dataCard: {
    padding: space(1.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.input,
    gap: space(0.75),
  },
  dataHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(0.75),
  },
  dataTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space(0.75),
  },
  bulletDot: {
    fontSize: 17,
    lineHeight: 21,
  },
  bulletCopy: {
    flex: 1,
  },
  footer: {
    marginTop: space(4),
    textAlign: "center",
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
