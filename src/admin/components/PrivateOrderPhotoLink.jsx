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
    // Ouvre la fenêtre pendant le clic utilisateur, puis y place l'URL signée.
    // Cela évite le blocage des pop-ups après l'appel asynchrone à l'API Strapi.
    const photoWindow = window.open('', '_blank');
    if (!photoWindow) {
      toggleNotification({ type: 'danger', message: 'Votre navigateur a bloqué l’ouverture de la photo.' });
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await get(`/admin/commandes/${encodeURIComponent(documentId)}/photo`);
      const url = data?.url || data?.data?.url;
      if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('URL privée invalide.');

      photoWindow.opener = null;
      photoWindow.location.replace(url);
    } catch {
      photoWindow.close();
      toggleNotification({ type: 'danger', message: 'Impossible d’ouvrir la photo privée de cette commande.' });
    } finally {
      setIsLoading(false);
    }
  };

  return <Button startIcon={<Eye />} size="S" fullWidth loading={isLoading} onClick={openPhoto}>Voir la photo</Button>;
}
