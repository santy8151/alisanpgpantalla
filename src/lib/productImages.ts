import compresor from "@/assets/prod-compresor.jpg";
import evaporador from "@/assets/prod-evaporador.jpg";
import condensador from "@/assets/prod-condensador.jpg";
import ventilador from "@/assets/prod-ventilador.jpg";
import trompo from "@/assets/prod-trompo.jpg";
import instalacion from "@/assets/prod-instalacion.jpg";

export const productImages: Record<string, string> = {
  compresor,
  evaporador,
  condensador,
  ventilador,
  trompo,
  instalacion,
};

export const productImageFor = (category: string) =>
  productImages[category] ?? productImages.instalacion;
