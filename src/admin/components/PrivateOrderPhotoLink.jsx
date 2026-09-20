import { Button } from '@strapi/design-system';
import { Eye } from '@strapi/icons';
import { useFetchClient, useNotification } from '@strapi/admin/strapi-admin';
import { useState } from 'react';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
})[character]);

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
    // Ouvre la fenêtre pendant le clic utilisateur, puis y place les aperçus.
    // Cela évite le blocage des pop-ups après l'appel asynchrone à l'API Strapi.
    const photoWindow = window.open('', '_blank');
    if (!photoWindow) {
      toggleNotification({ type: 'danger', message: 'Votre navigateur a bloqué l’ouverture de la photo.' });
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await get(`/admin/commandes/${encodeURIComponent(documentId)}/photo`);
      const count = Number(data?.count || data?.data?.count);
      if (!Number.isInteger(count) || count < 1) throw new Error('Photo privée invalide.');
      const photos = await Promise.all(
        Array.from({ length: count }, (_, index) =>
          get(`/admin/commandes/${encodeURIComponent(documentId)}/photo/${index}`, { responseType: 'blob' }),
        ),
      );
      const photoUrls = photos.map(({ data: photo }) => URL.createObjectURL(photo));

      photoWindow.opener = null;
      photoWindow.document.write(`<!doctype html>
        <html lang="fr"><head><meta charset="utf-8"><title>Photos de la commande</title>
        <style>body{margin:0;padding:32px;background:#f7f5f3;color:#302a26;font-family:system-ui,sans-serif}h1{max-width:1200px;margin:0 auto 24px;font-size:24px}.photos{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;max-width:1200px;margin:auto}.photo{margin:0;background:#fff;padding:12px;box-shadow:0 1px 6px #0002}.photo img{display:block;width:100%;height:auto}</style>
        </head><body><h1>${photoUrls.length} photo${photoUrls.length > 1 ? 's' : ''} de la commande</h1><main class="photos">${photoUrls.map((url, index) => `<figure class="photo"><img src="${escapeHtml(url)}" alt="Photo ${index + 1} de la commande"></figure>`).join('')}</main></body></html>`);
      photoWindow.document.close();
    } catch {
      photoWindow.close();
      toggleNotification({ type: 'danger', message: 'Impossible d’ouvrir les photos privées de cette commande.' });
    } finally {
      setIsLoading(false);
    }
  };

  return <Button startIcon={<Eye />} size="S" fullWidth loading={isLoading} onClick={openPhoto}>Voir les photos</Button>;
}
