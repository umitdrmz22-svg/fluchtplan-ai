
# Flucht- und Rettungsplan – AI Ersteller (Web Tabanlı)

Bu proje, **GitHub + Cloudflare Pages** ile yayınlanan ve **Cloudflare Workers AI** kullanan,
tarayıcıda çalışan bir **Flucht- und Rettungsplan** oluşturucudur. Kurulum için hiçbir şey indirmeniz gerekmez.

## Özellikler
- SVG/PNG kat planı yükleme ve görselleştirme
- ISO 7010 kodlu sembolleri tuvale yerleştirme (yer tutucu ikonlar)
- “Nordpfeil”, “Sie sind hier” işaretleri, efsane/legend
- AI destekli öneriler (yerleşim JSON’u, davranış metinleri)
- SVG / PNG dışa aktarma, PDF için tarayıcı yazdırma

## Hızlı Başlangıç
1. GitHub’da yeni repo oluşturun, bu dosyaları ekleyin.
2. Cloudflare Pages → **Connect to Git** ile repo’yu bağlayın → **Save and Deploy**.  
3. Workers AI’ı açın, proje **Secrets** kısmına `AI_API_TOKEN` ve `CF_ACCOUNT_ID` girin.
4. Yayın adresine gidin; `public/index.html` arayüzünü kullanın.

## Uyumluluk
- Tasarım **DIN ISO 23601** gerekliliklerine dayanır: A3, beyaz arka plan, ortak düzen, kuzey oku, konuma göre yönlendirme, efsane ve davranış talimatları vb.  
- Semboller **ISO 7010** kategorilerine (E/F/W/M) uygundur; ikonlar yer tutucudur. Resmi vektörleri lisanslı bir kaynaktan ekleyiniz.

> Kaynaklar:
> - Cloudflare Pages Git bağlantısı ve özellikler.  
> - Workers AI genel bakış ve modeller.  
> - DIN ISO 23601 tasarım rehberi (fluchtplan24, Baunormenlexikon).  
> - ISO 7010 standardı açıklaması.  

## Uyarı
Nihai planlar, yerel mevzuat ve denetim otoriteleri çerçevesinde **yetkin kişi** tarafından gözden geçirilmeli ve onaylanmalıdır.
