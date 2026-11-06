import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState, PageHeader } from '../components/ui';

export default function NotFound() {
  return (
    <div className="space-y-6">
      <PageHeader title="404" />
      <EmptyState
        icon={<Compass className="w-7 h-7" />}
        title="Page not found"
        description="The page you are looking for does not exist."
        action={
          <Link to="/" className="btn-primary mt-2">
            Back to dashboard
          </Link>
        }
      />
    </div>
  );
}
