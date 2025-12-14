# 🎲 3D Multiplayer Tavla Projesi (Frontend)

Bu proje, **React** ve **React-Three-Fiber** kullanılarak geliştirilmiş, tamamen 3D grafiklere ve animasyonlara sahip bir Tavla oyununun ön yüzüdür (Frontend).

---
Başlamadan önce Uyarı neden sedef ortalığı sikmiş dosyaları neden etrafta derseniz: 


### ⚠️ Dosya Yapısı Hakkında Önemli Not (Neden 'frontend' klasörü yok?)

Projedeki frontend dosyaları (`App.js`, `Backgammon.js` vb.), ayrı bir alt klasör yerine doğrudan **`src/`** dizininde tutulmuştur.

**Bunun Teknik Sebepleri:**
1.  **React Standartları:** React projelerinin giriş noktası olan `index.js` dosyası, varsayılan olarak `App.js` ve ana bileşenleri **kendi bulunduğu dizinde (`src/`)** arar.
2.  **Path (Dosya Yolu) Bütünlüğü:** Dosyaları alt klasörlere taşımak, React'in build (derleme) süreçlerinde *"Module not found"* hatalarına ve karmaşık import yollarına (`../../frontend/App.js` gibi) sebep olmaktadır.
3.  **Sorunsuz Çalışma:** Ekipteki herkesin projeyi indirdiğinde (`git clone`) hiçbir ayar yapmadan `npm start` diyerek çalıştırabilmesi için **standart React dizin yapısı** korunmuştur.

## 🚀 Proje Durumu: "Hazır ve Oynanabilir"

Şu an proje **Frontend** açısından tamamlanmıştır. Oyunun çalışması için bir sunucuya (Backend) ihtiyaç duymaması adına, içine **"Yalancı Backend" (Mock)** entegre edilmiştir.

### ✅ Neler Bitti?
* **3D Oyun Sahnesi:** Tahta, pullar, zarlar, ışıklandırma ve gölgeler.
* **Tüm Oyun Kuralları:** Zar atma, hamle yapma, taş kırma, taş toplama, yapılacak hamle yoksa pas geçme, çift zarda dört hamle yapma.
* **Kullanıcı Deneyimi (UX):**
    * **Hayalet Taş:** Taşı sürüklerken bırakacağınız yeri gösteren yarı saydam rehber.
    * **Animasyonlar:** Zar yuvarlanma ve açılış sinematiği.
* **Test Modu:** `src/backend-mock.js` sayesinde internetsiz tam tur oyun oynanabilir.

---

-----------------------BURAYA KADAR OKUYAN POMPİKOYA PANTALON BALIĞI YAZSIN!------------------- 

## 🛠 Kurulum ve Çalıştırma (Kendi Bilgisayarında Görmek İçin)

Projeyi bilgisayarınıza indirdikten sonra (`git clone` ile), terminalde şu adımları sırasıyla uygulayın:

### 1. Kütüphaneleri Yükle
Bu komut, projenin çalışması için gerekli tüm paketleri (React, Three.js vb.) indirir. İnternet hızına göre 1-2 dakika sürebilir.

```bash
npm install


-------->Ekip İçin: Backend Entegrasyon Rehberi!!!!!!!!!!!

Frontend tarafı hatasız bitti ve şu an gördüğünüz gibi çalışıyor. Aşağıda backend ile birleştirmek için yapmanız gerekenleri ve bu yapının nasıl gerçek sunucuya bağlanacağını en basit haliyle anlattım.

1. Bu Oyun Backend Olmadan Nasıl Çalışıyor? (Mantık)

Şu an oyunun beyni src/backend-mock.js dosyasıdır.

Bu dosya sanki bir Java sunucusuymuş gibi davranır.

Örneğin; "Zar At" butonuna basıldığında bu dosya "Tamam, 3-5 attım" der ve Frontend'e haber verir.

Özetle: Frontend şu an kendi kendine konuşuyor. Sizin göreviniz, bu konuşmayı Socket.IO üzerinden gerçek sunucuya taşımak.

2. Backend'e Bağlarken Hangi Dosyalarla Oynayacaksınız?
Gerçek sunucuyu (Java Backend) bağlamaya başladığınızda:

REFERANS ALINACAK (SİLİNMEYECEK AMA DEVRE DIŞI KALACAK):

src/backend-mock.js dosyasını hemen silmeyin! İçindeki oyun mantığı (sıra kimde, zar atma, hamle hesaplama, taş toplama kuralları) Java tarafında yazacağınız kodun birebir kopyası olmalıdır. Kopya çekmek için bunu kullanın.

DÜZENLENECEK DOSYA:

src/Backgammon.js dosyasını açın.

Şu an orada yerel fonksiyonlar çağrılıyor. Bunları Socket Event'lerine çevirmelisiniz.

Örnek Değişim:

Şu Anki Kod: gameRef.current.rollDice() (Yerel mock fonksiyonu)

Olması Gereken: socket.emit('rollDice') (Sunucuya istek)

------------>3. AI Yardımı İle Bağlantı Nasıl Yapılır? (Prompt)!!!!!!!!!!
Entegrasyon sırasında zorlanırsanız, kullandığınız Yapay Zekaya (ChatGPT, Claude, Gemini vb.) aşağıdaki metni olduğu gibi yapıştırın. Size gerekli Socket.IO kodlarını verecektir:

---------------------------BURAYA KADAR OKUYAN: POCİKERİM SENTARCI!--------------

🤖 AI Prompt (Kopyala/Yapıştır):

"Merhaba, elimde React ile yazılmış çalışan bir 3D Tavla Frontend'i var. Şu anda oyun mantığını src/backend-mock.js adında yerel bir JavaScript sınıfından alıyor.

Bizim gerçek backend'imiz Java ile yazılıyor ve iletişim için Socket.IO (veya WebSocket) kullanacağız.

Senden istediğim yardım şudur:

src/Backgammon.js dosyasındaki yerel fonksiyon çağrılarını (örneğin: gameRef.current.rollDice()), Socket.IO event'lerine (socket.emit) nasıl dönüştürürüm?

Sunucudan cevap geldiğinde (örneğin: socket.on('updateBoard', data => ...)) React state'ini nasıl güncellemeliyim?

useEffect hook'u içinde socket bağlantısını nasıl kurup dinlemeliyim?

Referans olarak elimdeki backend-mock.js dosyası oyunun tüm mantığını ve veri yapısını içeriyor. Bunu kullanarak bana bir entegrasyon şablonu hazırlar mısın?"

📂 Dosya Yapısı
src/Backgammon.js: Oyunun ana dosyası. 3D çizimler ve tıklama olayları burada.

src/backend-mock.js: Geçici oyun mantığı (Java'ya taşınacak mantık burada).

src/App.js: Uygulamanın giriş kapısı.

src/App.css: Siyah arka plan ayarı.

------------------------Yeah budur!------------------------------------------------------
Benden bu kadar gidip web projemi bitirecğim lav yu guys->sedef <3

---------------------------------------SON OLARAK Bİ BİRA Bİ SİGARA İÇİCEM soNRA DA FULL ON FULL ROCKN ROLL ve PUNK.