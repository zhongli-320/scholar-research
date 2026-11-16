import LiteratureHome from '../../_components/LiteratureHome';
import { recent, sources } from '../_data/paperseek';

export default function Page() {
  return <LiteratureHome mockData={{ sources, recent }} />;
}
