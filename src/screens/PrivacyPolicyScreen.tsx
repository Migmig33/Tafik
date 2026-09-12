import { useEffect } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from "react-native";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import { Screen, Title } from "../components";
import { space, useTheme } from "../theme";
import { Text } from "../typography";

const EFFECTIVE_DATE = "September 12, 2026";

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
          TockIn is an Android focus app. This policy explains the information the app accesses,
          what stays on your device, why each Android permission is used, and the choices you have.
          “TockIn,” “we,” and “us” mean the developer of the TockIn app.
        </Text>

        <Text style={[styles.note, { color: colors.text }]}>
          Please read this Privacy Policy carefully.
        </Text>

        <View style={styles.summary}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>The short version</Text>
          <Text style={[styles.paragraph, { color: colors.textDim }]}>
            You pay once and get every feature. There is nothing more to buy inside the app. TockIn
            has no accounts and no servers of ours behind it. There are no ads, no analytics, and no
            tracking, and we do not sell anything about you. Everything the app works out about your
            apps and your screen time is worked out on your own phone. If you have Android backup or
            device transfer switched on, that can still include TockIn’s data.
          </Text>
        </View>

        <PolicySection number="1" title="Scope and what we mean by “collect”">
          <Paragraph>
            This policy applies to the TockIn Android app. TockIn has to look at some information on
            your phone in order to work at all. Unless this policy says otherwise, that looking and
            that processing happen on the phone, and the developer never receives any of it. When we
            say TockIn does not “collect” something, we mean it is never sent from the app to us or to
            anyone acting for us.
          </Paragraph>
        </PolicySection>

        <PolicySection number="2" title="What TockIn looks at, and why">
          <Bullet title="App activity and screen time">
            With Android Usage Access, TockIn can see which app is open and how long your apps were
            used. During a focus session, TockIn checks the app on screen so it can shield one you chose
            to block. In StudIn, those checks apply during Study and stop during Break. With
            Accessibility enabled, TockIn is also told when a new app window opens and which app it
            belongs to. It is not able to read what is inside that window: no text, controls, taps,
            passwords, or content. Insights reads up to 14 days of your Android usage history to work
            out daily totals, time per app, charts, and trends. Android keeps those records; TockIn reads
            them when you open Insights and never uploads or copies them.
          </Bullet>

          <Bullet title="Your apps and your blocklist">
            TockIn reads the names and icons of the apps you can open from your home screen. That is
            what fills the Blocklist, and what puts real names and icons in Insights and on the
            blocking shield. The list of apps installed on a phone counts as personal and sensitive
            information, so TockIn saves only the apps you actually pick for your blocklist. It never
            uploads, sells, or shares the list of what you have installed.
          </Bullet>

          <Bullet title="NFC cards">
            When you start a card scan yourself, TockIn reads the card’s ID number. Registering a card
            reads it twice to be sure the number does not change. TockIn saves that number and the name
            you give the card, then checks later taps against your registered cards to start or end a
            session, or to start a StudIn cycle. A tap does not normally end a Study interval. TockIn
            reads nothing else on the card and never writes to it. The card’s number stays the same for
            the life of the card, so keep your phone locked when you are not using it.
          </Bullet>

          <Bullet title="Settings and things you create">
            TockIn saves your light or dark choice, whether you have finished setup, your card names
            and numbers, your blocklist, your StudIn Study and Break lengths and
            round count, the state of a session that is still running, a summary of each finished
            session, and how many emergency unlocks you have used this month. A finished session is
            saved as a date and a length, never as the apps you opened during it.
          </Bullet>

          <Bullet title="StudIn schedule and focus time">
            TockIn saves your Study length, Break length, round count, and enough timing to pick a
            running cycle back up if the app closes. Only Study time counts towards your focus totals.
            Break time is left out.
          </Bullet>

          <Bullet title="Permission and service status">
            TockIn checks whether Usage Access, Accessibility, display over other apps, NFC,
            notifications, Alarms & reminders, and full-screen alarm access are switched on, so it
            can guide you through setup and run what you asked for. It keeps no history of those
            changes. While a session is running, TockIn shows an ongoing notification, which is what
            lets blocking keep working in the background.
          </Bullet>
        </PolicySection>

        <PolicySection number="3" title="How each Android permission is used">
          <Bullet title="Usage Access">
            Spots the app on screen during a session, and works out your screen-time Insights on the
            phone.
          </Bullet>
          <Bullet title="Accessibility">
            Tells TockIn when a new app window opens while blocking is on, and which app it belongs to.
            If that app is on your blocklist, TockIn sends you straight back to your home screen. In
            StudIn this happens during Study, not during Break. TockIn cannot read what is inside the
            window.
          </Bullet>
          <Bullet title="Display over other apps">
            Puts TockIn’s shield over an app you blocked. The shield may show that app’s name and icon
            and the message you wrote.
          </Bullet>
          <Bullet title="NFC">
            Reads a card number only after you start a scan yourself. TockIn does not leave the NFC
            reader listening the rest of the time.
          </Bullet>
          <Bullet title="Seeing your apps">
            Lets TockIn list the apps you can open, so it can show their names and icons in the
            Blocklist and in Insights, and recognise them while blocking.
          </Bullet>
          <Bullet title="Notifications">
            Shows the ongoing session notification and StudIn countdown. Android requires it for
            blocking to keep running in the background, and it can sound and vibrate when a Study,
            Break, or full cycle ends.
          </Bullet>
          <Bullet title="Alarms & reminders">
            Lets Android deliver a StudIn timer alert on time while the phone is sleeping. Without
            it, Android may delay the alert.
          </Bullet>
          <Bullet title="Full-screen alarms">
            Optionally shows TockIn above the lock screen when a StudIn timer ends. It is not used to
            interrupt another app while the phone is unlocked.
          </Bullet>
          <Bullet title="Audio">
            Plays the sounds built into TockIn, including its StudIn alarm. TockIn does not ask for
            the microphone and does not record anything.
          </Bullet>
          <Bullet title="Storage">
            On Android 12 and earlier, apps built this way list a storage permission by default. TockIn
            never asks you for it and never uses it to look at your photos, media, documents, or files.
          </Bullet>
          <Paragraph>
            TockIn lists the internet permission that apps built this way include by default, but the app
            makes no internet requests of its own. TockIn does not ask for your location, camera,
            contacts, messages, call history, or microphone.
          </Paragraph>
        </PolicySection>

        <PolicySection number="4" title="What is saved on your phone, and for how long">
          <Paragraph>
            Everything TockIn saves is kept in private storage on your phone that other apps cannot
            read. Your blocklist, cards, preferences, and StudIn schedule stay there
            until you change them, remove them, clear TockIn’s storage, or uninstall the app. TockIn
            keeps only your 400 most recent finished sessions, and ignores anything shorter than five
            seconds. Emergency unlocks are counted by calendar month and refill on the 1st.
          </Paragraph>
          <Paragraph>
            The screen-time records themselves belong to Android, which decides how long to keep them.
            TockIn only ever reads the last 14 days of them. If you have Android backup or device
            transfer switched on, Android or your phone maker may back up and restore TockIn’s data
            under your own account settings and their privacy policy. TockIn does not run those backups
            and never receives them.
          </Paragraph>
        </PolicySection>

        <PolicySection number="5" title="Sharing, selling, analytics, and ads">
          <Paragraph>
            TockIn does not send us your blocklist, your list of installed apps, your usage activity,
            your Insights, your card numbers, your session history, or your
            settings. We do not sell, rent, share, or use any of it for advertising, analytics,
            tracking across apps, profiling, or marketing. The app contains no third-party advertising,
            analytics, or crash-reporting code.
          </Paragraph>
          <Paragraph>
            Google Play, Android, your device maker, and any backup provider may handle information of
            their own when they distribute the app, run the operating system, deal with diagnostics you
            switched on, or back up and restore your phone. That is governed by their own settings and
            privacy policies, and none of the on-device information above reaches us through them.
          </Paragraph>
          <Paragraph>
            TockIn is sold as a paid Google Play download. Google Play handles the payment outside the
            app, under Google&apos;s own terms and privacy policy. Google may give the developer the
            purchase, licensing, and financial reporting information needed to sell the app and keep
            the accounts straight. There is nothing to buy inside TockIn, and the app never sees or
            stores your card details.
          </Paragraph>
        </PolicySection>

        <PolicySection number="6" title="Your choices and controls">
          <Bullet title="Permissions">
            Turn Usage Access, Accessibility, display over other apps, NFC, notifications, Alarms &
            reminders, and full-screen alarms on or off in TockIn or Android Settings. Anything that
            needs a permission you removed will stop working. Full-screen alarms are optional and are
            used only when a StudIn timer ends while the phone is locked.
          </Bullet>
          <Bullet title="Cards and blocklist">
            Remove registered cards in TockIn’s card manager, and add or remove apps in the Blocklist.
          </Bullet>
          <Bullet title="StudIn schedule">
            Choose your Study length, Break length, and number of rounds before you start a cycle.
            Emergency unlock is the only way to end a Study interval early from inside the app.
          </Bullet>
          <Bullet title="Delete everything">
            Use Android Settings to clear TockIn’s storage, or uninstall TockIn. That removes the app’s
            copy, apart from any Android backup you control. Because there is no account and no server
            of ours, we cannot view, export, or delete the copy on your phone for you.
          </Bullet>
        </PolicySection>

        <PolicySection number="7" title="Security">
          <Paragraph>
            TockIn relies on Android keeping apps separate from each other, and on private storage other
            apps cannot open. No method of storing anything is completely secure. Someone who can
            unlock your phone, use debugging or backup tools, or break the operating system itself may
            be able to reach what is stored there. Keep Android updated, use a secure screen lock, and
            remove any card you no longer want saved.
          </Paragraph>
        </PolicySection>

        <PolicySection number="8" title="Automatic blocking, and the legal basis">
          <Paragraph>
            Blocking runs automatically on your phone: TockIn compares the app on screen with the
            blocklist you chose, and when it matches during a blocking interval it sends you back to
            your home screen, with the shield as a backup. StudIn follows the schedule you set, lifting
            the block when Study reaches zero, starting Break, and putting it back when the next Study
            begins. None of this makes decisions with legal consequences for you, and none of it builds
            an advertising profile. Where the law asks for a legal basis, this all happens on your own
            device, at your request, under permissions you control.
          </Paragraph>
        </PolicySection>

        <PolicySection number="9" title="Children’s privacy">
          <Paragraph>
            TockIn is not aimed at children under 13, and the developer does not knowingly collect
            personal information from children. Because TockIn has no accounts and sends us nothing, we
            never receive a user’s age or any of the information described in this policy.
          </Paragraph>
        </PolicySection>

        <PolicySection number="10" title="Changes to this policy">
          <Paragraph>
            We may update this policy when TockIn’s features, permissions, or legal obligations change.
            The updated policy will carry a new effective date. If a future feature ever sends data off
            your phone, this policy will be updated, and your consent asked for, before that starts.
          </Paragraph>
        </PolicySection>

        <PolicySection number="11" title="Contact">
          <Paragraph>
            For privacy questions or requests, write to kupdevs@gmail.com. Please do not include your
            card number. There is no record on our side for us to look up.
          </Paragraph>
        </PolicySection>

        <Text style={[styles.footer, { color: colors.textDim }]}>
          TockIn · Last updated {EFFECTIVE_DATE}
        </Text>
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

/** Every list entry on the policy, from a one-line permission to a paragraph. */
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
  // Sits between the intro and the summary, carrying a little more weight than
  // either so it reads as an instruction rather than another sentence of prose.
  note: {
    marginTop: space(1.5),
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  summary: {
    marginTop: space(2.5),
    gap: space(0.5),
  },
  summaryTitle: {
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
