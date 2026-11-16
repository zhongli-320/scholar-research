import SettingsPage from '../../settings/page';
export default function Page({ searchParams }: { searchParams: { tab?: string; section?: string } }) { return <fieldset disabled><SettingsPage searchParams={searchParams} /></fieldset>; }
