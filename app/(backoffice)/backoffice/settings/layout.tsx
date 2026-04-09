import { SettingsSectionChrome } from "./_components/SettingsSectionChrome";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SettingsSectionChrome>{children}</SettingsSectionChrome>;
}