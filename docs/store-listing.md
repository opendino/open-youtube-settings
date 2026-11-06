# Mağaza yayını: ilk yükleme ve anahtarlar

İlk yükleme her iki mağazada da elle yapılır. Sonraki sürümleri *Actions → Publish to stores* yükler.

Yüklenecek zip'ler [Releases](../../../releases/latest) sayfasında:

- `open-youtube-settings-chrome-vX.zip`
- `open-youtube-settings-firefox-vX.zip`

Görseller bu klasörde hazır:

| Ne | Dosya | Boyut |
| --- | --- | --- |
| Ekran görüntüleri (EN) | `docs/images/en/1-hero.jpg` … `7-layout.jpg` | 1280×800 |
| Ekran görüntüleri (TR) | `docs/images/tr/1-hero.jpg` … `7-layout.jpg` | 1280×800 |
| Küçük tanıtım kutusu (Chrome) | `docs/images/en/promo-tile-440x280.jpg` | 440×280 |
| Simge | `icon_128.png` | 128×128 |

---

## 1. Chrome Web Mağazası

### İlk yükleme
1. https://chrome.google.com/webstore/devconsole adresinde geliştirici hesabı aç (tek seferlik 5 $).
2. **New item** → Chrome zip'ini yükle.
3. **Store listing** sekmesi:
   - Açıklama: aşağıdaki *Uzun açıklama* metni.
   - Kategori: **Productivity** (Verimlilik) ya da **Tools**.
   - Dil: English (varsayılan). Diğer diller için aşağıdaki *Diller* bölümüne bak.
   - Ekran görüntüleri: `docs/images/en/` içindeki 7 görsel.
   - Small promo tile: `promo-tile-440x280.jpg`.
4. **Privacy** sekmesi:
   - *Single purpose:* "Adds playback, colour, crop, clip and layout controls to YouTube's own player and pages."
   - *storage justification:* "Saves the user's settings, shortcuts and blocked channels locally."
   - *Host permission (youtube.com) justification:* "The extension only runs on YouTube pages to change the player and the page layout."
   - *Remote code:* **No, I am not using remote code.**
   - *Data usage:* hiçbir kutuyu işaretleme. Alttaki üç beyanı onayla.
   - *Privacy policy URL:* veri toplanmadığı için zorunlu değil. İstenirse README'nin Gizlilik bölümüne bağlantı ver.
5. **Submit for review**.

### Otomatik yükleme için anahtarlar
GitHub'da *Settings → Secrets and variables → Actions → New repository secret* ile şunları ekle:

| Secret | Nereden |
| --- | --- |
| `CHROME_EXTENSION_ID` | Geliştirici panelinde eklentinin 32 harflik kimliği |
| `CHROME_PUBLISHER_ID` | Geliştirici panelinde *Account* sayfasındaki Publisher ID |
| `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN` | Google Cloud'da Chrome Web Store API için OAuth istemcisi. Adım adım rehber: https://github.com/fregante/chrome-webstore-upload-keys |

## 2. Firefox Eklentileri (AMO)

### İlk yükleme
1. https://addons.mozilla.org/developers/ adresinde giriş yap → **Submit a New Add-on**.
2. **On this site** (listelenmiş) seçeneğini seç ve Firefox zip'ini yükle.
3. Kaynak kodu sorusu: kod küçültülmemiş (minified değil), **No** de.
4. Açıklama: aşağıdaki metin. Kategori: **Photos, Music & Videos** ya da **Appearance**. Ekran görüntüleri: `docs/images/en/`.
5. Lisans: istediğin lisansı seç.

### Otomatik yükleme için anahtarlar
https://addons.mozilla.org/developers/addon/api/key/ sayfasında **Generate new credentials** ile:

| Secret | Değer |
| --- | --- |
| `AMO_API_KEY` | JWT issuer (`user:12345:67` gibi) |
| `AMO_API_SECRET` | JWT secret |

## 3. Sonraki sürümler
1. `manifest.json` ve `package.json` içindeki sürümü yükselt.
2. `git tag vX.Y && git push origin vX.Y` komutunu çalıştır. Testler çalışır, ardından GitHub Release oluşur.
3. *Actions → Publish to stores → Run workflow*. Etiketi boş bırakırsan son sürüm yüklenir.

---

## Mağaza metinleri

### Diller
Mağaza, sayfayı kullanıcının Chrome dil ayarına göre gösterir. Kendi metni olmayan dillerde varsayılan dil (English) görünür.

- **Ad ve kısa açıklama:** eklentinin `_locales` klasöründen otomatik gelir. 20 dil hazır: en, tr, de, es, fr, it, pt_BR, nl, pl, ru, uk, ar, hi, id, vi, th, ko, ja, zh_CN, zh_TW.
- **Uzun açıklama:** *Mağaza girişi* sayfasının üstündeki *Dil* menüsünden dili seç ve aşağıdaki metinlerden o dilinkini yapıştır. Her dil için ayrı ayrı yapılır.
- **Ekran görüntüleri:** *Yerelleştirilmiş ekran görüntüleri* boş kalan dillerde *Genel ekran görüntüleri* gösterilir. EN ve TR için hazır görseller var (`docs/images/en`, `docs/images/tr`).
- **Yeni bir dil:** önce eklentiye `_locales/<dil>` eklenip yeni sürüm çıkmalı. Yoksa o dilde ad ve kısa açıklama İngilizce kalır.

### Kısa açıklama
Mağazalar bunu eklentinin içinden (`appDesc`) her dil için otomatik alır.

> Speed control, colour filters, video crop, clips, Shorts blocking and channel blocking for YouTube — right in the player.

### Uzun açıklama (English)

```
Open Youtube Settings puts the controls you wish YouTube had right into its own player.

BLOCK CHANNELS
• Hover over a recommended video and press 🚫 — every video from that channel is covered on home, search and the end screen.
• Unblock any time from the popup.

SPEED
• The current speed sits in YouTube's control bar — click it for presets and fine steps.
• A default speed for every video, or keep the last one between videos.
• Your own keyboard shortcuts to speed up, slow down and reset.

CROP
• Drag over the video like taking a screenshot; it keeps playing, zoomed to fit or fill the player.
• One click shows the whole video again.

CLIPS
• Mark a start and an end, preview the loop and save it as a video file.

COLOUR
• Brightness, blue-light filter and colour inversion, with shortcuts to adjust them.

A CALMER YOUTUBE
• Turn off Shorts completely — shelves, search results, menu entry and channel tab.
• Hide the home feed, the sidebar or the playlist.
• Block channels from recommendations with one click.
• Mute ads automatically; the sound returns when the ad ends.
• Open channels straight on their Videos tab.

ALSO
• One switch turns everything off.
• Search across all settings.
• Light, dark or automatic appearance.
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

PRIVACY
No data is collected or sent anywhere. Settings stay in your browser.
```

### Uzun açıklama (Türkçe)

```
Open Youtube Ayarları, YouTube'da olmasını istediğin kontrolleri doğrudan oynatıcıya getirir.

KANAL ENGELLEME
• Önerilen bir videonun üzerine gel ve 🚫 düğmesine bas — o kanalın tüm videoları ana sayfada, aramada ve video sonunda örtülür.
• Engeli istediğin zaman eklenti penceresinden kaldır.

HIZ
• Geçerli hız YouTube'un kontrol çubuğunda — tıkla, hazır hızlardan ve ince adımlardan seç.
• Her video için varsayılan hız ya da son hızı videolar arasında koruma.
• Hızlandırma, yavaşlatma ve sıfırlama için kendi klavye kısayolların.

KIRPMA
• Ekran görüntüsü alır gibi videoda alan seç; video oynamaya devam eder, oynatıcıya sığar ya da doldurur.
• Tek tıkla videonun tamamına geri dön.

KLİP
• Başlangıç ve bitişi işaretle, döngüde önizle, video dosyası olarak kaydet.

RENK
• Parlaklık, mavi ışık filtresi ve renkleri tersine çevirme; kısayollarla ayarlanabilir.

DAHA SAKİN BİR YOUTUBE
• Shorts'u tamamen kapat — raflar, arama sonuçları, menü girişi ve kanal sekmesi.
• Ana sayfa akışını, kenar çubuğunu ya da oynatma listesini gizle.
• Önerilerdeki kanalları tek tıkla engelle.
• Reklamların sesini otomatik kapat; reklam bitince ses geri gelir.
• Kanalları doğrudan Videolar sekmesinde aç.

AYRICA
• Tek düğmeyle her şeyi kapat.
• Tüm ayarlarda arama.
• Açık, koyu ya da otomatik görünüm.
• 20 dil desteği.

GİZLİLİK
Hiçbir veri toplanmaz ve hiçbir yere gönderilmez. Ayarlar tarayıcında kalır.
```

### Uzun açıklama (Deutsch)

```
Open Youtube Einstellungen bringt die Steuerelemente, die YouTube fehlen, direkt in den eigenen Player.

KANÄLE BLOCKIEREN
• Fahre mit der Maus über ein empfohlenes Video und drücke 🚫 – alle Videos dieses Kanals werden auf der Startseite, in der Suche und im Abspann verdeckt.
• Die Sperre lässt sich jederzeit im Popup aufheben.

GESCHWINDIGKEIT
• Die aktuelle Geschwindigkeit steht in der Steuerleiste von YouTube – ein Klick öffnet Voreinstellungen und feine Schritte.
• Eine Standardgeschwindigkeit für jedes Video oder die letzte Geschwindigkeit zwischen Videos beibehalten.
• Eigene Tastenkürzel zum Beschleunigen, Verlangsamen und Zurücksetzen.

ZUSCHNEIDEN
• Ziehe wie bei einem Screenshot einen Bereich über das Video; es läuft weiter und wird in den Player eingepasst oder füllt ihn aus.
• Ein Klick zeigt wieder das ganze Video.

CLIPS
• Start und Ende markieren, die Schleife ansehen und als Videodatei speichern.

FARBE
• Helligkeit, Blaulichtfilter und Farben umkehren, mit Tastenkürzeln einstellbar.

EIN RUHIGERES YOUTUBE
• Shorts komplett ausschalten – Regale, Suchergebnisse, Menüeintrag und Kanal-Tab.
• Startseite, Seitenleiste oder Playlist ausblenden.
• Kanäle mit einem Klick aus den Empfehlungen blockieren.
• Werbung automatisch stummschalten; der Ton kommt zurück, sobald die Werbung endet.
• Kanäle direkt im Tab „Videos“ öffnen.

AUSSERDEM
• Ein Schalter schaltet alles aus.
• Suche in allen Einstellungen.
• Helles, dunkles oder automatisches Design.
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

DATENSCHUTZ
Es werden keine Daten gesammelt oder irgendwohin gesendet. Die Einstellungen bleiben in deinem Browser.
```

### Uzun açıklama (Español)

```
Ajustes de Open Youtube lleva al propio reproductor de YouTube los controles que te gustaría que tuviera.

BLOQUEAR CANALES
• Pasa el ratón sobre un vídeo recomendado y pulsa 🚫: todos los vídeos de ese canal quedan cubiertos en la página de inicio, en la búsqueda y en la pantalla final.
• Desbloquéalo cuando quieras desde la ventana de la extensión.

VELOCIDAD
• La velocidad actual aparece en la barra de controles de YouTube: haz clic para ver velocidades predefinidas y pasos finos.
• Una velocidad predeterminada para cada vídeo, o mantener la última entre vídeos.
• Tus propios atajos de teclado para acelerar, ralentizar y restablecer.

RECORTE
• Arrastra sobre el vídeo como si hicieras una captura de pantalla; sigue reproduciéndose, ajustado al reproductor o llenándolo.
• Un clic vuelve a mostrar el vídeo completo.

CLIPS
• Marca un inicio y un final, previsualiza el bucle y guárdalo como archivo de vídeo.

COLOR
• Brillo, filtro de luz azul e inversión de colores, con atajos para ajustarlos.

UN YOUTUBE MÁS TRANQUILO
• Desactiva los Shorts por completo: estanterías, resultados de búsqueda, entrada del menú y pestaña del canal.
• Oculta el feed de inicio, la barra lateral o la lista de reproducción.
• Bloquea canales de las recomendaciones con un clic.
• Silencia los anuncios automáticamente; el sonido vuelve cuando termina el anuncio.
• Abre los canales directamente en su pestaña Vídeos.

ADEMÁS
• Un solo interruptor lo desactiva todo.
• Búsqueda en todos los ajustes.
• Apariencia clara, oscura o automática.
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

PRIVACIDAD
No se recopila ni se envía ningún dato. Los ajustes se quedan en tu navegador.
```

### Uzun açıklama (Français)

```
Paramètres Open Youtube ajoute directement dans le lecteur de YouTube les commandes qui lui manquent.

BLOQUER DES CHAÎNES
• Survolez une vidéo recommandée et appuyez sur 🚫 : toutes les vidéos de cette chaîne sont masquées sur l'accueil, dans la recherche et sur l'écran de fin.
• Débloquez-la à tout moment depuis la fenêtre de l'extension.

VITESSE
• La vitesse actuelle s'affiche dans la barre de commandes de YouTube : cliquez pour les vitesses prédéfinies et les réglages fins.
• Une vitesse par défaut pour chaque vidéo, ou la dernière vitesse conservée d'une vidéo à l'autre.
• Vos propres raccourcis clavier pour accélérer, ralentir et réinitialiser.

RECADRAGE
• Sélectionnez une zone de la vidéo comme pour une capture d'écran ; elle continue de jouer, ajustée au lecteur ou en le remplissant.
• Un clic réaffiche la vidéo entière.

CLIPS
• Marquez un début et une fin, prévisualisez la boucle et enregistrez-la en fichier vidéo.

COULEUR
• Luminosité, filtre anti-lumière bleue et inversion des couleurs, avec des raccourcis pour les régler.

UN YOUTUBE PLUS CALME
• Désactivez complètement les Shorts : étagères, résultats de recherche, entrée du menu et onglet de la chaîne.
• Masquez le flux d'accueil, la barre latérale ou la playlist.
• Bloquez des chaînes dans les recommandations en un clic.
• Coupez automatiquement le son des publicités ; il revient dès la fin de la publicité.
• Ouvrez les chaînes directement sur leur onglet Vidéos.

ET AUSSI
• Un seul interrupteur désactive tout.
• Recherche dans tous les réglages.
• Apparence claire, sombre ou automatique.
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

CONFIDENTIALITÉ
Aucune donnée n'est collectée ni envoyée. Vos réglages restent dans votre navigateur.
```

### Uzun açıklama (Português – Brasil)

```
Configurações do Open Youtube coloca no próprio player do YouTube os controles que você gostaria que ele tivesse.

BLOQUEAR CANAIS
• Passe o mouse sobre um vídeo recomendado e clique em 🚫 — todos os vídeos desse canal ficam cobertos na página inicial, na busca e na tela final.
• Desbloqueie quando quiser pela janela da extensão.

VELOCIDADE
• A velocidade atual fica na barra de controles do YouTube — clique para ver velocidades prontas e ajustes finos.
• Uma velocidade padrão para todos os vídeos, ou manter a última entre um vídeo e outro.
• Seus próprios atalhos de teclado para acelerar, desacelerar e redefinir.

RECORTE
• Arraste sobre o vídeo como numa captura de tela; ele continua tocando, ajustado ao player ou preenchendo-o.
• Um clique mostra o vídeo inteiro de novo.

CLIPES
• Marque o início e o fim, veja o loop e salve como arquivo de vídeo.

COR
• Brilho, filtro de luz azul e inversão de cores, com atalhos para ajustar.

UM YOUTUBE MAIS TRANQUILO
• Desative os Shorts por completo — prateleiras, resultados de busca, item do menu e aba do canal.
• Oculte o feed inicial, a barra lateral ou a playlist.
• Bloqueie canais das recomendações com um clique.
• Silencie anúncios automaticamente; o som volta quando o anúncio termina.
• Abra canais direto na aba Vídeos.

TAMBÉM
• Um único botão desliga tudo.
• Busca em todas as configurações.
• Aparência clara, escura ou automática.
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

PRIVACIDADE
Nenhum dado é coletado ou enviado. As configurações ficam no seu navegador.
```

### Uzun açıklama (日本語)

```
Open Youtube 設定は、YouTube にあったらいいのにと思う操作を、YouTube のプレーヤーそのものに追加します。

チャンネルのブロック
• おすすめ動画にカーソルを合わせて 🚫 を押すだけ。そのチャンネルの動画は、ホーム、検索結果、終了画面でまとめて隠れます。
• ブロックはポップアップからいつでも解除できます。

再生速度
• 現在の速度は YouTube の操作バーに表示されます。クリックするとプリセットや細かい刻みを選べます。
• すべての動画に既定の速度を設定するか、前の動画の速度を引き継げます。
• 速くする・遅くする・リセットを、自分で決めたキーボードショートカットで。

トリミング
• スクリーンショットを撮るように動画の範囲をドラッグ。再生は続き、プレーヤーに収めるか全体に広げて表示します。
• ワンクリックで動画全体の表示に戻ります。

クリップ
• 開始と終了を指定し、ループで確認して、動画ファイルとして保存できます。

色
• 明るさ、ブルーライトフィルター、色の反転。ショートカットでも調整できます。

もっと落ち着いた YouTube
• ショートを完全にオフ：棚、検索結果、メニュー項目、チャンネルのタブまで。
• ホームフィード、サイドバー、再生リストを非表示に。
• おすすめに出てくるチャンネルをワンクリックでブロック。
• 広告を自動でミュート。広告が終わると音が戻ります。
• チャンネルを最初から「動画」タブで開きます。

そのほか
• スイッチひとつですべてオフ。
• すべての設定を検索。
• ライト、ダーク、自動の外観。
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

プライバシー
データの収集や送信は一切ありません。設定はブラウザの中に保存されます。
```

### Uzun açıklama (हिन्दी)

```
Open Youtube सेटिंग्स वे कंट्रोल सीधे YouTube के अपने प्लेयर में ले आता है, जिनकी कमी आपको YouTube में खलती है।

चैनल ब्लॉक करें
• किसी सुझाए गए वीडियो पर माउस ले जाएँ और 🚫 दबाएँ — उस चैनल के सभी वीडियो होम पेज, सर्च और एंड स्क्रीन पर ढक जाते हैं।
• पॉपअप से कभी भी अनब्लॉक करें।

स्पीड
• मौजूदा स्पीड YouTube के कंट्रोल बार में दिखती है — क्लिक करके तय स्पीड या बारीक चरण चुनें।
• हर वीडियो के लिए डिफ़ॉल्ट स्पीड, या पिछली स्पीड को अगले वीडियो में भी बनाए रखें।
• स्पीड बढ़ाने, घटाने और रीसेट करने के लिए अपने कीबोर्ड शॉर्टकट।

वीडियो क्रॉप
• स्क्रीनशॉट लेने की तरह वीडियो पर एक हिस्सा चुनें; वीडियो चलता रहता है और प्लेयर में फ़िट होता है या उसे पूरा भर देता है।
• एक क्लिक से पूरा वीडियो फिर से दिखता है।

क्लिप
• शुरुआत और अंत चुनें, लूप में देखें और वीडियो फ़ाइल के रूप में सेव करें।

रंग
• ब्राइटनेस, ब्लू लाइट फ़िल्टर और रंग उलटना, शॉर्टकट से भी एडजस्ट करें।

शांत YouTube
• Shorts पूरी तरह बंद करें — शेल्फ़, सर्च नतीजे, मेन्यू एंट्री और चैनल टैब।
• होम फ़ीड, साइडबार या प्लेलिस्ट छिपाएँ।
• सुझावों में आने वाले चैनल एक क्लिक में ब्लॉक करें।
• विज्ञापनों को अपने-आप म्यूट करें; विज्ञापन खत्म होते ही आवाज़ लौट आती है।
• चैनल सीधे उनके वीडियो टैब पर खोलें।

और भी
• एक स्विच से सब कुछ बंद करें।
• सभी सेटिंग्स में खोजें।
• लाइट, डार्क या ऑटोमैटिक थीम।
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

गोपनीयता
कोई डेटा इकट्ठा नहीं किया जाता और कहीं नहीं भेजा जाता। सेटिंग्स आपके ब्राउज़र में ही रहती हैं।
```

### Uzun açıklama (Italiano)

```
Impostazioni Open Youtube porta direttamente nel player di YouTube i controlli che vorresti avesse.

BLOCCA I CANALI
• Passa il mouse su un video consigliato e premi 🚫: tutti i video di quel canale vengono coperti nella home, nella ricerca e nella schermata finale.
• Puoi sbloccarlo quando vuoi dalla finestra dell'estensione.

VELOCITÀ
• La velocità attuale è nella barra dei controlli di YouTube: fai clic per le velocità rapide e i passi fini.
• Una velocità predefinita per ogni video, oppure mantieni l'ultima tra un video e l'altro.
• Le tue scorciatoie da tastiera per accelerare, rallentare e ripristinare.

RITAGLIO
• Trascina sul video come per uno screenshot; continua a riprodursi, adattato al player o riempiendolo.
• Un clic mostra di nuovo tutto il video.

CLIP
• Segna inizio e fine, guarda l'anteprima in loop e salvala come file video.

COLORE
• Luminosità, filtro luce blu e inversione dei colori, con scorciatoie per regolarli.

UN YOUTUBE PIÙ TRANQUILLO
• Disattiva completamente gli Shorts: scaffali, risultati di ricerca, voce di menu e scheda del canale.
• Nascondi il feed della home, la barra laterale o la playlist.
• Blocca i canali dai consigli con un clic.
• Silenzia automaticamente gli annunci; l'audio torna appena l'annuncio finisce.
• Apri i canali direttamente sulla scheda Video.

INOLTRE
• Un solo interruttore disattiva tutto.
• Ricerca in tutte le impostazioni.
• Aspetto chiaro, scuro o automatico.
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

PRIVACY
Nessun dato viene raccolto o inviato. Le impostazioni restano nel tuo browser.
```

### Uzun açıklama (Русский)

```
Настройки Open Youtube добавляют в плеер YouTube те элементы управления, которых вам в нём не хватало.

БЛОКИРОВКА КАНАЛОВ
• Наведите курсор на рекомендуемое видео и нажмите 🚫 — все видео этого канала будут скрыты на главной, в поиске и на конечной заставке.
• Разблокировать канал можно в любой момент во всплывающем окне.

СКОРОСТЬ
• Текущая скорость показана на панели управления YouTube — нажмите, чтобы выбрать готовое значение или мелкий шаг.
• Скорость по умолчанию для всех видео или сохранение последней скорости между видео.
• Собственные сочетания клавиш, чтобы ускорить, замедлить и сбросить скорость.

ОБРЕЗКА
• Выделите область видео, как при снимке экрана; воспроизведение продолжится, а область впишется в плеер или заполнит его.
• Один клик снова показывает всё видео.

КЛИПЫ
• Отметьте начало и конец, просмотрите фрагмент по кругу и сохраните его как видеофайл.

ЦВЕТ
• Яркость, фильтр синего света и инверсия цветов с настройкой через сочетания клавиш.

СПОКОЙНЫЙ YOUTUBE
• Полностью отключите Shorts — полки, результаты поиска, пункт меню и вкладку канала.
• Скройте ленту главной, боковую панель или плейлист.
• Блокируйте каналы в рекомендациях одним кликом.
• Автоматически выключайте звук рекламы; он вернётся, как только реклама закончится.
• Открывайте каналы сразу на вкладке «Видео».

ТАКЖЕ
• Один переключатель выключает всё.
• Поиск по всем настройкам.
• Светлое, тёмное или автоматическое оформление.
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

КОНФИДЕНЦИАЛЬНОСТЬ
Никакие данные не собираются и никуда не отправляются. Настройки хранятся в вашем браузере.
```

### Uzun açıklama (Українська)

```
Налаштування Open Youtube додають у плеєр YouTube ті елементи керування, яких вам у ньому бракувало.

БЛОКУВАННЯ КАНАЛІВ
• Наведіть курсор на рекомендоване відео й натисніть 🚫 — усі відео цього каналу буде приховано на головній, у пошуку та на кінцевій заставці.
• Розблокувати канал можна будь-коли у спливному вікні.

ШВИДКІСТЬ
• Поточна швидкість показана на панелі керування YouTube — натисніть, щоб вибрати готове значення або дрібний крок.
• Швидкість за замовчуванням для всіх відео або збереження останньої швидкості між відео.
• Власні сполучення клавіш, щоб пришвидшити, сповільнити та скинути швидкість.

ОБРІЗКА
• Виділіть область відео, як під час знімка екрана; відтворення триває, а область вписується в плеєр або заповнює його.
• Один клік знову показує все відео.

КЛІПИ
• Позначте початок і кінець, перегляньте фрагмент по колу й збережіть його як відеофайл.

КОЛІР
• Яскравість, фільтр синього світла та інверсія кольорів з налаштуванням через сполучення клавіш.

СПОКІЙНИЙ YOUTUBE
• Повністю вимкніть Shorts — полиці, результати пошуку, пункт меню та вкладку каналу.
• Сховайте стрічку головної, бічну панель або плейлист.
• Блокуйте канали в рекомендаціях одним кліком.
• Автоматично вимикайте звук реклами; він повернеться, щойно реклама закінчиться.
• Відкривайте канали одразу на вкладці «Відео».

ТАКОЖ
• Один перемикач вимикає все.
• Пошук у всіх налаштуваннях.
• Світлий, темний або автоматичний вигляд.
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

КОНФІДЕНЦІЙНІСТЬ
Жодні дані не збираються й нікуди не надсилаються. Налаштування зберігаються у вашому браузері.
```

### Uzun açıklama (Polski)

```
Ustawienia Open Youtube dodają do odtwarzacza YouTube elementy sterowania, których w nim brakuje.

BLOKOWANIE KANAŁÓW
• Najedź na polecany film i naciśnij 🚫 — wszystkie filmy tego kanału zostaną zakryte na stronie głównej, w wyszukiwarce i na ekranie końcowym.
• Odblokujesz go w każdej chwili w oknie rozszerzenia.

PRĘDKOŚĆ
• Aktualna prędkość jest na pasku sterowania YouTube — kliknij, by wybrać gotową wartość lub drobny krok.
• Domyślna prędkość dla każdego filmu albo zachowanie ostatniej prędkości między filmami.
• Własne skróty klawiszowe do przyspieszania, zwalniania i resetu.

KADROWANIE
• Zaznacz obszar filmu jak przy zrzucie ekranu; film gra dalej, dopasowany do odtwarzacza albo go wypełniając.
• Jedno kliknięcie znowu pokazuje cały film.

KLIPY
• Zaznacz początek i koniec, obejrzyj pętlę i zapisz ją jako plik wideo.

KOLOR
• Jasność, filtr światła niebieskiego i odwracanie kolorów, ze skrótami do regulacji.

SPOKOJNIEJSZY YOUTUBE
• Całkowicie wyłącz Shorts — półki, wyniki wyszukiwania, pozycję w menu i kartę kanału.
• Ukryj stronę główną, pasek boczny lub playlistę.
• Blokuj kanały z polecanych jednym kliknięciem.
• Automatycznie wyciszaj reklamy; dźwięk wraca, gdy reklama się skończy.
• Otwieraj kanały od razu na karcie Filmy.

PONADTO
• Jeden przełącznik wyłącza wszystko.
• Wyszukiwanie we wszystkich ustawieniach.
• Jasny, ciemny lub automatyczny wygląd.
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

PRYWATNOŚĆ
Żadne dane nie są zbierane ani nigdzie wysyłane. Ustawienia zostają w Twojej przeglądarce.
```

### Uzun açıklama (Nederlands)

```
Open Youtube-instellingen zet de bediening die je in YouTube mist direct in de eigen speler.

KANALEN BLOKKEREN
• Beweeg over een aanbevolen video en druk op 🚫: alle video's van dat kanaal worden afgedekt op de startpagina, in de zoekresultaten en op het eindscherm.
• Deblokkeer het wanneer je wilt in het venster van de extensie.

SNELHEID
• De huidige snelheid staat in de bedieningsbalk van YouTube: klik voor voorinstellingen en fijne stappen.
• Een standaardsnelheid voor elke video, of de laatste snelheid behouden tussen video's.
• Je eigen sneltoetsen om te versnellen, te vertragen en te resetten.

BIJSNIJDEN
• Sleep over de video zoals bij een screenshot; hij speelt door, passend in de speler of vullend.
• Eén klik toont weer de hele video.

CLIPS
• Markeer een begin en einde, bekijk de lus en sla hem op als videobestand.

KLEUR
• Helderheid, blauwlichtfilter en kleuren omkeren, met sneltoetsen om ze aan te passen.

EEN RUSTIGER YOUTUBE
• Zet Shorts volledig uit: planken, zoekresultaten, menu-item en kanaaltabblad.
• Verberg de startpagina-feed, de zijbalk of de afspeellijst.
• Blokkeer kanalen uit de aanbevelingen met één klik.
• Demp advertenties automatisch; het geluid komt terug zodra de advertentie voorbij is.
• Open kanalen direct op het tabblad Video's.

VERDER
• Eén schakelaar zet alles uit.
• Zoeken in alle instellingen.
• Lichte, donkere of automatische weergave.
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

PRIVACY
Er worden geen gegevens verzameld of verstuurd. Je instellingen blijven in je browser.
```

### Uzun açıklama (Bahasa Indonesia)

```
Pengaturan Open Youtube menambahkan kontrol yang Anda harapkan ada di YouTube, langsung ke pemutarnya sendiri.

BLOKIR CHANNEL
• Arahkan kursor ke video rekomendasi dan tekan 🚫 — semua video dari channel itu ditutupi di beranda, penelusuran, dan layar akhir.
• Buka blokir kapan saja dari jendela ekstensi.

KECEPATAN
• Kecepatan saat ini ada di bilah kontrol YouTube — klik untuk preset dan langkah halus.
• Kecepatan default untuk setiap video, atau pertahankan kecepatan terakhir antar-video.
• Pintasan keyboard Anda sendiri untuk mempercepat, memperlambat, dan mereset.

POTONG
• Seret di atas video seperti mengambil tangkapan layar; video tetap berjalan, pas di pemutar atau memenuhinya.
• Satu klik menampilkan seluruh video lagi.

KLIP
• Tandai awal dan akhir, pratinjau dalam loop, lalu simpan sebagai file video.

WARNA
• Kecerahan, filter cahaya biru, dan pembalikan warna, dengan pintasan untuk mengaturnya.

YOUTUBE YANG LEBIH TENANG
• Matikan Shorts sepenuhnya — rak, hasil penelusuran, entri menu, dan tab channel.
• Sembunyikan feed beranda, sidebar, atau playlist.
• Blokir channel dari rekomendasi dengan satu klik.
• Bisukan iklan secara otomatis; suara kembali begitu iklan selesai.
• Buka channel langsung di tab Video.

LAINNYA
• Satu tombol mematikan semuanya.
• Cari di semua pengaturan.
• Tampilan terang, gelap, atau otomatis.
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

PRIVASI
Tidak ada data yang dikumpulkan atau dikirim ke mana pun. Pengaturan tetap di browser Anda.
```

### Uzun açıklama (Tiếng Việt)

```
Cài đặt Open Youtube đưa những điều khiển bạn mong YouTube có vào ngay trình phát của YouTube.

CHẶN KÊNH
• Di chuột lên một video đề xuất và nhấn 🚫 — mọi video của kênh đó sẽ bị che ở trang chủ, kết quả tìm kiếm và màn hình kết thúc.
• Bỏ chặn bất cứ lúc nào trong cửa sổ tiện ích.

TỐC ĐỘ
• Tốc độ hiện tại nằm trên thanh điều khiển của YouTube — nhấn để chọn mức có sẵn hoặc bước nhỏ.
• Tốc độ mặc định cho mọi video, hoặc giữ tốc độ cuối cùng giữa các video.
• Phím tắt riêng để tăng, giảm và đặt lại tốc độ.

CẮT KHUNG
• Kéo trên video như khi chụp màn hình; video vẫn chạy, vừa với trình phát hoặc lấp đầy nó.
• Một cú nhấp để xem lại toàn bộ video.

CLIP
• Đánh dấu điểm đầu và cuối, xem trước theo vòng lặp và lưu thành tệp video.

MÀU SẮC
• Độ sáng, bộ lọc ánh sáng xanh và đảo màu, có phím tắt để điều chỉnh.

YOUTUBE NHẸ NHÀNG HƠN
• Tắt hoàn toàn Shorts — kệ Shorts, kết quả tìm kiếm, mục menu và tab kênh.
• Ẩn nguồn cấp trang chủ, thanh bên hoặc danh sách phát.
• Chặn kênh khỏi đề xuất chỉ với một cú nhấp.
• Tự động tắt tiếng quảng cáo; âm thanh trở lại khi quảng cáo kết thúc.
• Mở kênh thẳng ở tab Video.

NGOÀI RA
• Một công tắc tắt mọi thứ.
• Tìm kiếm trong mọi cài đặt.
• Giao diện sáng, tối hoặc tự động.
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

QUYỀN RIÊNG TƯ
Không thu thập hay gửi bất kỳ dữ liệu nào. Cài đặt nằm trong trình duyệt của bạn.
```

### Uzun açıklama (ไทย)

```
การตั้งค่า Open Youtube เพิ่มตัวควบคุมที่คุณอยากให้ YouTube มี ลงในเพลเยอร์ของ YouTube โดยตรง

บล็อกช่อง
• วางเมาส์บนวิดีโอแนะนำแล้วกด 🚫 วิดีโอทั้งหมดของช่องนั้นจะถูกปิดบังในหน้าแรก ผลการค้นหา และหน้าจอตอนจบ
• เลิกบล็อกได้ทุกเมื่อจากหน้าต่างส่วนขยาย

ความเร็ว
• ความเร็วปัจจุบันอยู่บนแถบควบคุมของ YouTube คลิกเพื่อเลือกค่าที่ตั้งไว้หรือปรับละเอียด
• ตั้งความเร็วเริ่มต้นให้ทุกวิดีโอ หรือคงความเร็วล่าสุดไว้ระหว่างวิดีโอ
• ปุ่มลัดของคุณเองสำหรับเร่ง ลด และรีเซ็ตความเร็ว

ครอป
• ลากบนวิดีโอเหมือนตอนจับภาพหน้าจอ วิดีโอยังเล่นต่อ โดยพอดีกับเพลเยอร์หรือเต็มเพลเยอร์
• คลิกเดียวเพื่อดูทั้งวิดีโออีกครั้ง

คลิป
• กำหนดจุดเริ่มและจุดจบ ดูตัวอย่างแบบวนซ้ำ แล้วบันทึกเป็นไฟล์วิดีโอ

สี
• ความสว่าง ฟิลเตอร์แสงสีฟ้า และการกลับสี พร้อมปุ่มลัดสำหรับปรับ

YOUTUBE ที่สงบขึ้น
• ปิด Shorts ทั้งหมด ทั้งชั้นวาง ผลการค้นหา เมนู และแท็บช่อง
• ซ่อนฟีดหน้าแรก แถบด้านข้าง หรือเพลย์ลิสต์
• บล็อกช่องจากรายการแนะนำได้ในคลิกเดียว
• ปิดเสียงโฆษณาอัตโนมัติ เสียงจะกลับมาเมื่อโฆษณาจบ
• เปิดช่องที่แท็บวิดีโอโดยตรง

อื่นๆ
• สวิตช์เดียวปิดทุกอย่าง
• ค้นหาในการตั้งค่าทั้งหมด
• รูปลักษณ์สว่าง มืด หรืออัตโนมัติ
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

ความเป็นส่วนตัว
ไม่มีการเก็บหรือส่งข้อมูลใดๆ การตั้งค่าอยู่ในเบราว์เซอร์ของคุณเท่านั้น
```

### Uzun açıklama (한국어)

```
Open Youtube 설정은 YouTube에 있었으면 하는 기능을 YouTube 플레이어에 바로 더해 줍니다.

채널 차단
• 추천 동영상에 마우스를 올리고 🚫를 누르면 그 채널의 모든 동영상이 홈, 검색 결과, 최종 화면에서 가려집니다.
• 차단은 확장 프로그램 창에서 언제든지 해제할 수 있습니다.

재생 속도
• 현재 속도가 YouTube 컨트롤 바에 표시됩니다. 클릭하면 프리셋과 세밀한 단계를 고를 수 있습니다.
• 모든 동영상의 기본 속도를 정하거나, 마지막 속도를 다음 동영상에도 유지하세요.
• 빠르게, 느리게, 초기화를 나만의 단축키로.

자르기
• 스크린샷을 찍듯 동영상 위를 드래그하세요. 재생은 계속되고, 선택한 영역이 플레이어에 맞춰지거나 플레이어를 채웁니다.
• 한 번 클릭하면 전체 동영상이 다시 보입니다.

클립
• 시작과 끝을 표시하고 반복 재생으로 확인한 뒤 동영상 파일로 저장하세요.

색상
• 밝기, 블루라이트 필터, 색상 반전을 단축키로도 조절할 수 있습니다.

더 차분한 YouTube
• Shorts를 완전히 끄기 — 선반, 검색 결과, 메뉴 항목, 채널 탭까지.
• 홈 피드, 사이드바, 재생목록 숨기기.
• 추천에 나오는 채널을 클릭 한 번으로 차단.
• 광고를 자동으로 음소거하고, 광고가 끝나면 소리가 돌아옵니다.
• 채널을 바로 동영상 탭으로 열기.

그 밖에
• 스위치 하나로 모두 끄기.
• 모든 설정 검색.
• 라이트, 다크, 자동 화면 모드.
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

개인정보 보호
어떤 데이터도 수집하거나 전송하지 않습니다. 설정은 브라우저에만 저장됩니다.
```

### Uzun açıklama (简体中文)

```
Open Youtube 设置把你希望 YouTube 拥有的控件，直接加到 YouTube 自己的播放器里。

屏蔽频道
• 将鼠标悬停在推荐视频上并按 🚫，该频道的所有视频都会在首页、搜索结果和片尾画面中被遮住。
• 随时可以在扩展窗口中取消屏蔽。

播放速度
• 当前速度显示在 YouTube 控制栏中，点击即可选择预设或细微调整。
• 为所有视频设置默认速度，或在视频之间保持上一次的速度。
• 用自己的快捷键加速、减速和重置。

裁剪
• 像截图一样在视频上拖动选择区域；视频继续播放，区域适应播放器或填满播放器。
• 点击一次即可重新显示完整视频。

片段
• 标记开始和结束，循环预览，然后保存为视频文件。

色彩
• 亮度、蓝光过滤和反转颜色，并可用快捷键调节。

更清爽的 YouTube
• 完全关闭 Shorts：板块、搜索结果、菜单项和频道标签页。
• 隐藏首页推荐、侧边栏或播放列表。
• 一键屏蔽推荐中的频道。
• 自动将广告静音，广告结束后声音恢复。
• 直接在“视频”标签页打开频道。

其他
• 一个开关即可关闭全部功能。
• 搜索所有设置。
• 浅色、深色或自动外观。
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

隐私
不收集也不发送任何数据。设置只保存在你的浏览器中。
```

### Uzun açıklama (繁體中文)

```
Open Youtube 設定把你希望 YouTube 擁有的控制項，直接加到 YouTube 自己的播放器裡。

封鎖頻道
• 將滑鼠停在推薦影片上並按 🚫，該頻道的所有影片都會在首頁、搜尋結果和片尾畫面中被遮住。
• 隨時可以在擴充功能視窗中解除封鎖。

播放速度
• 目前速度顯示在 YouTube 控制列中，點選即可選擇預設值或細微調整。
• 為所有影片設定預設速度，或在影片之間保留上一次的速度。
• 用自己的快速鍵加速、減速和重設。

裁剪
• 像截圖一樣在影片上拖曳選取區域；影片繼續播放，區域符合播放器或填滿播放器。
• 按一下即可重新顯示完整影片。

片段
• 標記開始和結束，循環預覽，然後儲存為影片檔案。

色彩
• 亮度、藍光濾鏡和反轉顏色，並可用快速鍵調整。

更清爽的 YouTube
• 完全關閉 Shorts：區塊、搜尋結果、選單項目和頻道分頁。
• 隱藏首頁推薦、側邊欄或播放清單。
• 一鍵封鎖推薦中的頻道。
• 自動將廣告靜音，廣告結束後聲音恢復。
• 直接在「影片」分頁開啟頻道。

其他
• 一個開關即可關閉所有功能。
• 搜尋所有設定。
• 淺色、深色或自動外觀。
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

隱私權
不收集也不傳送任何資料。設定只儲存在你的瀏覽器中。
```

### Uzun açıklama (العربية)

```
تضيف إعدادات Open Youtube عناصر التحكم التي تتمنى وجودها في YouTube مباشرة إلى مشغل YouTube نفسه.

حظر القنوات
• مرّر المؤشر فوق فيديو مقترح واضغط 🚫 — تُغطّى كل فيديوهات تلك القناة في الصفحة الرئيسية ونتائج البحث وشاشة النهاية.
• يمكنك إلغاء الحظر في أي وقت من نافذة الإضافة.

السرعة
• تظهر السرعة الحالية في شريط تحكم YouTube — انقر لاختيار سرعة جاهزة أو خطوة دقيقة.
• سرعة افتراضية لكل فيديو، أو الاحتفاظ بآخر سرعة بين الفيديوهات.
• اختصارات لوحة مفاتيح خاصة بك للتسريع والإبطاء وإعادة الضبط.

القص
• اسحب فوق الفيديو كما لو كنت تلتقط لقطة شاشة؛ يستمر التشغيل ويتناسب الجزء مع المشغل أو يملؤه.
• نقرة واحدة تعيد عرض الفيديو كاملًا.

المقاطع
• حدّد البداية والنهاية، وعاين المقطع بشكل متكرر، واحفظه كملف فيديو.

الألوان
• السطوع وفلتر الضوء الأزرق وعكس الألوان، مع اختصارات لضبطها.

YouTube أكثر هدوءًا
• أوقف Shorts بالكامل — الرفوف ونتائج البحث وعنصر القائمة وتبويب القناة.
• أخفِ خلاصة الصفحة الرئيسية أو الشريط الجانبي أو قائمة التشغيل.
• احظر القنوات من الاقتراحات بنقرة واحدة.
• اكتم صوت الإعلانات تلقائيًا؛ يعود الصوت فور انتهاء الإعلان.
• افتح القنوات مباشرة على تبويب الفيديوهات.

أيضًا
• مفتاح واحد يوقف كل شيء.
• البحث في كل الإعدادات.
• مظهر فاتح أو داكن أو تلقائي.
• English, Türkçe, Deutsch, Español, Français, Italiano, Português (Brasil), Nederlands, Polski, Русский, Українська, العربية, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, 한국어, 日本語, 简体中文, 繁體中文.

الخصوصية
لا يتم جمع أي بيانات أو إرسالها إلى أي مكان. تبقى الإعدادات في متصفحك.
```
