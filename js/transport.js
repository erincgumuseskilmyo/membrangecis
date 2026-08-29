/* ============================================================
   TRANSPORT.JS
   Taşıma mekanizmaları ve seçim sistemi.
   Seçim: ↑ ↓ ile sırayla, 1-6 tuşlarıyla ya da yandaki
   mekanizma rayına tıklayarak/dokunarak.
============================================================ */

const TRANSPORT_MODES = [
  {
    id: 'simple_diffusion',
    label: 'BASİT DİFÜZYON',
    short: 'DİFÜZYON',
    chip: 'DİFÜZYON',
    color: '#4FD1C5',
    channelAsset: 'channel_simple_diffusion',
    energy: 'PASİF',
    info: 'Zardan yardımsız, konsantrasyon farkıyla geçiş.',
  },
  {
    id: 'facilitated_diffusion',
    label: 'KOLAYLAŞTIRILMIŞ DİFÜZYON',
    short: 'KOLAY. DİFÜZYON',
    chip: 'KOLAY DİF.',
    color: '#9F7AEA',
    channelAsset: 'channel_facilitated_diffusion',
    energy: 'PASİF',
    info: 'Taşıyıcı protein aracılığıyla geçiş.',
  },
  {
    id: 'osmosis',
    label: 'OSMOZ',
    short: 'OSMOZ',
    chip: 'OSMOZ',
    color: '#4299E1',
    channelAsset: 'channel_osmosis',
    energy: 'PASİF',
    info: 'Suyun yarı geçirgen zardan geçişi.',
  },
  {
    id: 'active_transport',
    label: 'AKTİF TAŞIMA',
    short: 'AKTİF TAŞIMA',
    chip: 'AKTİF',
    color: '#F6AD55',
    channelAsset: 'channel_active_transport',
    energy: 'ATP',
    info: 'ATP harcanarak, gradyana karşı taşıma.',
  },
  {
    id: 'endocytosis',
    label: 'ENDOSİTOZ',
    short: 'ENDOSİTOZ',
    chip: 'ENDOSİTOZ',
    color: '#F687B3',
    channelAsset: 'channel_endocytosis',
    energy: 'ATP',
    info: 'Büyük parçacığın zar tarafından sarılması.',
  },
  {
    id: 'exocytosis',
    label: 'EKZOSİTOZ',
    short: 'EKZOSİTOZ',
    chip: 'EKZOSİTOZ',
    color: '#FC8181',
    channelAsset: 'channel_exocytosis',
    energy: 'ATP',
    info: 'Hücre içi ürünün vezikülle dışarı atılması.',
  },
];

const TRANSPORT_BY_ID = TRANSPORT_MODES.reduce((acc, m) => {
  acc[m.id] = m;
  return acc;
}, {});

class TransportSystem {
  constructor() {
    this.index = 0;
  }

  reset() {
    this.index = 0;
  }

  change(direction) {
    // direction: 1 = aşağı (sıradaki), -1 = yukarı (önceki)
    this.index =
      (this.index + direction + TRANSPORT_MODES.length) % TRANSPORT_MODES.length;
    return this.current;
  }

  selectIndex(index) {
    if (index < 0 || index >= TRANSPORT_MODES.length) return null;
    if (index === this.index) return null; // değişiklik yok
    this.index = index;
    return this.current;
  }

  get current() {
    return TRANSPORT_MODES[this.index];
  }
}
