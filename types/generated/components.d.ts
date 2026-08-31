import type { Schema, Struct } from '@strapi/strapi';

export interface PrestationFormule extends Struct.ComponentSchema {
  collectionName: 'components_prestation_formules';
  info: {
    displayName: 'Formule';
  };
  attributes: {
    acompte_pourcentage: Schema.Attribute.Decimal &
      Schema.Attribute.DefaultTo<30>;
    details: Schema.Attribute.Text;
    duree: Schema.Attribute.String & Schema.Attribute.Required;
    nom: Schema.Attribute.String & Schema.Attribute.Required;
    nombre_photos: Schema.Attribute.Integer & Schema.Attribute.Required;
    ordre: Schema.Attribute.Integer & Schema.Attribute.Required;
    prix: Schema.Attribute.Decimal & Schema.Attribute.Required;
  };
}

export interface ProduitCaracteristique extends Struct.ComponentSchema {
  collectionName: 'components_produit_caracteristiques';
  info: {
    displayName: 'Caract\u00E9ristique';
  };
  attributes: {
    ordre: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    texte: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'prestation.formule': PrestationFormule;
      'produit.caracteristique': ProduitCaracteristique;
    }
  }
}
