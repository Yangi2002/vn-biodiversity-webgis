import type { HeroSlide } from '../../shared/components/hero-slider/hero-slider.types';
import type { CredentialLink } from '../../shared/components/credentials-footer/credentials-footer.component';

export interface HomeFeatureLink {
  title: string;
  label: string;
  description: string;
  route: string;
}

export interface HomeSourceGroup {
  name: string;
  image: string;
  description: string;
}

export interface TrustedSource {
  name: string;
  url: string;
}

export const VNSC_LOGO_SRC =
  '/images/home/VNSC.jfif';

export const HOME_FEATURE_LINKS: readonly HomeFeatureLink[] = [
  {
    title: 'Tra cứu loài',
    label: 'Từ điển',
    description: 'Tìm theo tên Việt Nam, tên khoa học, họ, bộ, lớp hoặc từ khóa.',
    route: '/search',
  },
  {
    title: 'Bản đồ phân bố',
    label: 'WebGIS',
    description: 'Xem điểm ghi nhận và dữ liệu phân bố loài trên bản đồ.',
    route: '/map',
  },
  {
    title: 'Phân loại sinh học',
    label: 'Taxonomy',
    description: 'Lọc theo cây phân loại: giới, ngành, lớp, bộ, họ, chi, loài.',
    route: '/species',
  },
  {
    title: 'Bảo tồn và nguồn dữ liệu',
    label: 'Danh sách đỏ',
    description: 'Xem trạng thái bảo tồn, danh sách đỏ và nguồn tham chiếu.',
    route: '/species',
  },
  {
    title: 'Danh mục loài',
    label: 'Species list',
    description: 'Duyệt các nhóm động vật, thực vật và côn trùng trong hệ thống.',
    route: '/species',
  },
];

export const HOME_HERO_SLIDES: readonly HeroSlide[] = [
  { src: '/images/home/slides/plant-1.jpg', title: 'Thực vật', caption: 'Nguồn tham chiếu thực vật Việt Nam' },
  { src: '/images/home/slides/plant-2.jpg', title: 'Thực vật', caption: 'Tra cứu tên Việt Nam và tên khoa học' },
  { src: '/images/home/slides/animal-1.jpg', title: 'Động vật', caption: 'Dữ liệu loài từ VNCreatures' },
  { src: '/images/home/slides/insect-1.jpg', title: 'Côn trùng', caption: 'Bộ sưu tập ảnh côn trùng' },
  { src: '/images/home/slides/animal-2.jpg', title: 'Động vật', caption: 'Ghi nhận và mô tả sinh học' },
  { src: '/images/home/slides/plant-3.jpg', title: 'Thực vật', caption: 'Dữ liệu mô tả và bảo tồn' },
  { src: '/images/home/slides/animal-3.jpg', title: 'Động vật', caption: 'Thông tin phân bố theo loài' },
  { src: '/images/home/slides/insect-2.jpg', title: 'Côn trùng', caption: 'Hỗ trợ tra cứu theo nhóm phân loại' },
  { src: '/images/home/slides/insect-3.jpg', title: 'Côn trùng', caption: 'Kết nối dữ liệu bản đồ WebGIS' },
];

export const HOME_SOURCE_GROUPS: readonly HomeSourceGroup[] = [
  {
    name: 'Động vật',
    image: '/images/home/animal.jpg',
    description: 'Các loài thú, chim, bò sát, cá và nhiều nhóm động vật khác.',
  },
  {
    name: 'Thực vật',
    image: '/images/home/plant.jpg',
    description: 'Cây gỗ, cây thân thảo, lan, nấm và các nhóm thực vật bản địa.',
  },
  {
    name: 'Côn trùng',
    image: '/images/home/insect.jpg',
    description: 'Bướm, bọ cánh cứng, ong, chuồn chuồn và các nhóm côn trùng.',
  },
];

export const TRUSTED_SOURCES: readonly TrustedSource[] = [
  { name: 'GBIF', url: 'https://www.gbif.org/' },
  { name: 'iNaturalist', url: 'https://www.inaturalist.org/' },
  { name: 'VNCreatures', url: 'https://www.vncreatures.net/' },
];

export const FOOTER_CREDENTIAL_LINKS: readonly CredentialLink[] = [
  { label: 'GBIF', url: 'https://www.gbif.org/' },
  { label: 'iNaturalist', url: 'https://www.inaturalist.org/' },
  { label: 'VNCreatures', url: 'https://www.vncreatures.net/' },
];
