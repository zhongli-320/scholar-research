import LiteratureRunScreen from './LiteratureRunScreen';
export default function Page({ params }: { params: { id: string } }) {
  return <LiteratureRunScreen id={params.id} />;
}
