KANAL GÖRSELLERİ — DURUM

Oyun şu anda altı taşıma mekanizmasının kanalını canvas ile ÇİZER
(js/assets.js -> ChannelArt). Bu klasördeki iki PNG oyunda
KULLANILMIYOR; silinmedi, kaynak olarak duruyor.

Neden: altı mekanizmanın tamamı için birbiriyle uyumlu görsel seti
yoktu. Karışık stil yerine hepsi aynı görsel dille çizildi; çizim
her çözünürlükte nettir, animasyonludur ve dosya boyutu yoktur.

Görsel dosyalarına dönmek isterseniz:
1) Aşağıdaki altı dosyayı bu klasöre koyun:
     channel_simple_diffusion.png
     channel_facilitated_diffusion.png
     channel_osmosis.png
     channel_active_transport.png
     channel_endocytosis.png
     channel_exocytosis.png
2) js/assets.js dosyasının başındaki
     const USE_CHANNEL_IMAGES = false;
   satırını true yapın.
Görseller saydam zeminli, kare ve zarın ortasına oturacak şekilde
hazırlanmalıdır (ideal: 256x256).
