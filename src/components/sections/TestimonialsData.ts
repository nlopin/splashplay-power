import { type TranslationNamespace } from "../../utils/i18n";
import svetaImg from "../../assets/photo/reviews/sveta1.webp";
import marioImg from "../../assets/photo/reviews/mario.webp";
import eliseoImg from "../../assets/photo/reviews/eliseo.webp";
import anastasiaImg from "../../assets/photo/reviews/anastasia.webp";
import sergioImg from "../../assets/photo/reviews/sergio.webp";
import jorjeImg from "../../assets/photo/reviews/jorje.webp";
import jordiImg from "../../assets/photo/reviews/jordi.webp";
import aleixImg from "../../assets/photo/reviews/aleix.webp";
import auroraImg from "../../assets/photo/reviews/aurora.webp";
import semihImg from "../../assets/photo/reviews/semih.webp";
import kateImg from "../../assets/photo/reviews/kate.webp";
import marieImg from "../../assets/photo/reviews/marie.webp";
import alinaImg from "../../assets/photo/reviews/alina.webp";
import katiaImg from "../../assets/photo/reviews/katia.webp";

type Testimonial = {
  name: string;
  avatar: ImageMetadata;
  contentKey: string; // a key from "main.reviews" translation file
};

const sveta: Testimonial = {
  name: "Sveta",
  avatar: svetaImg,
  contentKey: "sveta",
};
const mario: Testimonial = {
  name: "Mario",
  avatar: marioImg,
  contentKey: "mario",
};
const eliseo: Testimonial = {
  name: "Eliseo",
  avatar: eliseoImg,
  contentKey: "eliseo",
};
const anastasia: Testimonial = {
  name: "Anastasia",
  avatar: anastasiaImg,
  contentKey: "anastasia",
};
const jorge: Testimonial = {
  name: "Jorge",
  avatar: jorjeImg,
  contentKey: "jorje",
};
const sergio: Testimonial = {
  name: "Sergio",
  avatar: sergioImg,
  contentKey: "sergio",
};
const jordi: Testimonial = {
  name: "Jordi",
  avatar: jordiImg,
  contentKey: "jordi",
};
const aleix: Testimonial = {
  name: "Aleix",
  avatar: aleixImg,
  contentKey: "aleix",
};
const aurora: Testimonial = {
  name: "Aurora",
  avatar: auroraImg,
  contentKey: "aurora",
};
const semih: Testimonial = {
  name: "Semih",
  avatar: semihImg,
  contentKey: "semih",
};
const kate: Testimonial = {
  name: "Kate",
  avatar: kateImg,
  contentKey: "kate",
};
const marie: Testimonial = {
  name: "Marie",
  avatar: marieImg,
  contentKey: "marie",
};
const alina: Testimonial = {
  name: "Alina",
  avatar: alinaImg,
  contentKey: "alina",
};
const katia: Testimonial = {
  name: "Katia",
  avatar: katiaImg,
  contentKey: "katia",
};

export type TestimonalGroup = "friends" | "couples" | "family" | "company";

export const testimonialOrder: Record<TestimonalGroup, Testimonial[]> = {
  friends: [sveta, katia, anastasia, mario, marie, alina, aleix],
  couples: [kate, semih, aleix, marie, alina, sergio, mario],
  family: [jorge, jordi, aleix, marie, mario, alina, sergio],
  company: [eliseo, aurora, mario, aleix, sergio, alina, marie],
};
