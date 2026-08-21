import type { CredentialLink } from '../../shared/components/credentials-footer/credentials-footer.component';
import type { HeroSlide } from '../../shared/components/hero-slider/hero-slider.types';

export interface HomeFeatureLink {
  title: string;
  label: string;
  description: string;
  route: string;
  icon: string;
  status: string;
  queryParams?: Record<string, string>;
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

export const VNSC_LOGO_SRC = '/images/home/VNSC.jfif';

export const HOME_FEATURE_LINKS: readonly HomeFeatureLink[] = [
  {
    title: 'Tra cứu loài',
    label: 'Dictionary',
    description: 'Tìm theo tên Việt Nam, tên khoa học, họ, bộ, lớp hoặc từ khóa liên quan.',
    route: '/species-list',
    icon: '🔍',
    status: 'Mở danh sách',
  },
  {
    title: 'Danh mục loài',
    label: 'Species list',
    description: 'Duyệt động vật, thực vật và côn trùng trong hệ thống với phân trang và bộ lọc.',
    route: '/species-list',
    icon: '📚',
    status: 'Xem tất cả',
  },
  {
    title: 'Phân loại sinh học',
    label: 'Taxonomy',
    description: 'Khám phá loài theo nhóm sinh vật, lớp, bộ, họ, chi và cây phân loại trong hồ sơ loài.',
    route: '/taxonomy',
    icon: '🧬',
    status: 'Duyệt phân loại',
  },
  {
    title: 'Bản đồ phân bố',
    label: 'WebGIS',
    description: 'Xem điểm ghi nhận và dữ liệu phân bố loài trên bản đồ WebGIS.',
    route: '/map',
    icon: '🗺️',
    status: 'Mở bản đồ',
  },
  {
    title: 'Thống kê loài',
    label: 'Statistics',
    description: 'Xem thống kê theo loài, vùng ghi nhận, nguồn dữ liệu và xu hướng occurrence.',
    route: '/statistics',
    icon: '📊',
    status: 'Xem thống kê',
  },
  {
    title: 'Danh sách đỏ',
    label: 'VN Red List',
    description: 'Theo dõi các loài có nguy cơ tuyệt chủng từ dữ liệu VN Red List.',
    route: '/endangered-species',
    icon: '📕',
    status: 'Xem hồ sơ',
    queryParams: { focus: 'source' },
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
    description: 'Cây gỗ, cây thân thảo, lan và các nhóm thực vật bản địa.',
  },
  {
    name: 'Côn trùng',
    image: '/images/home/insect.jpg',
    description: 'Bướm, bọ cánh cứng, ong, chuồn chuồn và các nhóm côn trùng.',
  },
  {
    name: 'Nấm',
    image: '/images/home/fungi.jpg',
    description: 'Nấm lớn, nấm túi, nấm đảm và nhiều nhóm nấm ghi nhận tại Việt Nam.',
  },
];

export const TRUSTED_SOURCES: readonly TrustedSource[] = [
  { name: 'VNCreatures', url: 'https://www.vncreatures.net/' },
  { name: 'Sinh vật Việt Nam', url: 'https://vncreatures.net/species/' },
  { name: 'Vườn quốc gia Việt Nam', url: 'https://sinhvatvietnam.vn/ban-do-vuon-quoc-gia/' },
  { name: 'VN Red List', url: 'http://vnredlist.vast.vn/' },
  { name: 'NBCA', url: 'https://dadangsinhhoc.mae.gov.vn/' },
  { name: 'NBDS', url: 'https://nbds.cebid.vn/' },
  { name: 'GBIF', url: 'https://www.gbif.org/' },
  { name: 'iNaturalist', url: 'https://www.inaturalist.org/' },
  { name: 'Catalogue of Life', url: 'https://www.catalogueoflife.org/' },
  { name: 'EOL', url: 'https://eol.org/' },
  { name: 'Wikimedia Commons', url: 'https://commons.wikimedia.org/' },
  { name: 'MycoBank', url: 'https://www.mycobank.org/' },
  { name: 'Index Fungorum', url: 'https://www.indexfungorum.org/' },
  { name: 'First Nature', url: 'https://www.first-nature.com/' },
  { name: 'MushroomExpert', url: 'https://www.mushroomexpert.com/' },
  { name: 'MykoWeb', url: 'https://www.mykoweb.com/' },
  {
    name: 'Mushroom Field Manual',
    url: 'https://humidtropics.cgiar.org/wp-content/uploads/downloads/2014/04/Final_Mushroom-Field-Manual_Mar-2014_for-WEB.pdf',
  },
  { name: 'Pù Huống Nghệ An', url: 'https://puhuong.nghean.gov.vn/hoat-dong-bao-ton/ket-qua-thuc-hien-nhiem-vu-dieu-tra-thanh-phan-va-de-xuat-giai-phap-phat-trien-hieu-qua-ben-vung-cac-loai-nam-an-nam-duoc-lieu-tai-khu-bttn-pu-huong-nghe-an-380.html' },
  {
    name: 'ResearchGate Fungi',
    url: 'https://www.researchgate.net/publication/340393889_ISOLATION_AND_STUDY_ON_PURE_CULTURE_OF_WILD_EDIBLE_MUSHROOMS_COLLECTED_FROM_PROVINCES_IN_THE_SOUTHEAST_REGION_OF_VIETNAM',
  },
  { name: 'NCBI Taxonomy', url: 'https://www.ncbi.nlm.nih.gov/datasets/taxonomy/4751/' },
  { name: 'NCBI Gene', url: 'https://www.ncbi.nlm.nih.gov/home/genes/' },
];

export const FOOTER_CREDENTIAL_LINKS: readonly CredentialLink[] = TRUSTED_SOURCES.map(({ name, url }) => ({
  label: name,
  url,
}));
