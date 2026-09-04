import { Button } from '@strapi/design-system';
import { Eye } from '@strapi/icons';
import { useFetchClient, useNotification } from '@strapi/admin/strapi-admin';
import { useState } from 'react';

const getDocumentId = () => {
  const segments = window.location.pathname.split('/').filter(Boolean);
  const contentManagerIndex = segments.indexOf('collection-types');
  if (contentManagerIndex === -1 || decodeURIComponent(segments[contentManagerIndex + 1] || '') !== 'api::commande.commande') return null;
  return segments[contentManagerIndex + 2] || null;
};

export default function PrivateOrderPhotoLink() {
  const { get } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [isLoading, setIsLoading] = useState(false);
  const documentId = getDocumentId();

  if (!documentId) return null;

  const openPhoto = async () => {
    setIsLoading(true);
    try {
      const { data } = await get(`/admin/commandes/${encodeURIComponent(documentId)}/photo`);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      toggleNotification({ type: 'danger', message: 'Impossible d’ouvrir la photo privée de cette commande.' });
    } finally {
      setIsLoading(false);
    }
  };

  return <Button startIcon={<Eye />} size="S" fullWidth loading={isLoading} onClick={openPhoto}>Voir la photo</Button>;
}
