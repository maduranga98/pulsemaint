# Storage සහ දත්ත — සුරැකීම, මැකීම, කාල සීමා (සිංහල)

මෙම ලේඛනය `storage.rules`, `firestore.rules`, Cloud Functions සහ UI කේතය කියවා සකස් කළ ය. අංක ඇති කාල සීමා කේතයේ ඇති ඒවායි. "යෝජිත" යැයි සලකුණු කළ ඒවා තවම කේතයේ නැත.

## 1. දත්ත ගබඩා වන තැන් තුන

| ගබඩාව | අඩංගු දේ | තවත් විස්තර |
|---|---|---|
| **Firestore** (`default` database, region `nam5`) | WO, breakdowns, safety cases, work permits, users, inventory, PM, training වාර්තා, ආදිය | ලේඛන (documents) |
| **Cloud Storage** | ඡායාරූප, signatures/PDF, documents, වීඩියෝ, generated reports | ෆයිල් |
| **Firebase Auth** | login accounts, custom claims (`companyId`, `superadmin`) | token ≈ පැය 1 |

**Tenant (සමාගම) වෙන් කිරීම:** Firestore ලේඛනවල `companyId`/`siteId` ඇත, rules වලින් සමාගමෙන් පිට ප්‍රවේශය වළක්වයි. Storage rules වලට Firestore කියවිය නොහැකි නිසා ඒවා login token හි `companyId` claim එක පරීක්ෂා කරයි.

## 2. Storage path එකින් එක

"ලිවීම" යනු Storage rules අනුව යැයි සැලකිය යුතුයි. "කවුද" යන තීරුව UI route/rules අනුව ඇති භූමිකා පෙන්වයි. Storage rules වලට role පරීක්ෂා කළ නොහැකි නිසා, Storage ස්ථරයේ දී පරීක්ෂා වන්නේ **එම සමාගමේ සාමාජිකයෙක්ද** යන්න පමණි. භූමිකා සීමා UI/route ස්ථරයෙන් පැමිණේ.

### 2.1 එක් වරක් පමණක් උඩුගත කළ හැකි වාර්තා (Create-only: නැවත ලිවීමක්/මැකීමක් client වලින් නැහැ)

| Path | අන්තර්ගතය | උඩුගත කළ හැක්කේ (UI/route) | මැකීම | කාල සීමාව |
|---|---|---|---|---|
| `workorders/{siteId}/{woId}/documents/…` | WO සමඟ අමුණන ලේඛන | WO සාදන `supervisor`, `plant_manager`, `admin` | client වලින් **නැහැ** | කිසිදා ස්වයංක්‍රීයව මැකෙන්නේ නැහැ |
| `workorders/…/field-media/…` | ක්ෂේත්‍ර ඡායාරූප/වීඩියෝ | අදාළ WO හි technician/trainee, supervisor | **නැහැ** | ස්ථිර |
| `workorders/…/completion/{photos,cad,warranty}/…` | අවසාන ඡායාරූප, CAD, වගකීම් ලේඛන | technician/trainee (WO සම්පූර්ණ කරන විට) | **නැහැ** | ස්ථිර |
| `workorders/…/approval-requests/…` | "Hold · Approval" ඉල්ලීම් ෆයිල් | technician/trainee, plant manager | **නැහැ** | ස්ථිර |
| `breakdowns/{siteId}/{ticketId}/media/…` | Breakdown ඡායාරූප/වීඩියෝ | `floor_operator`, `technician`, `trainee`, `supervisor`, `plant_manager`, `admin` | **නැහැ** | ස්ථිර |
| `audit_attachments/{plantId}/…` සහ `audit_reports/{plantId}/…` | Audit සාක්ෂි සහ PDF | `safety_officer`, `supervisor`, `plant_manager`, `admin`, `hr_officer` | **නැහැ** | ස්ථිර |
| `audits/{plantId}/…` | 5S audit ඡායාරූප | audit භූමිකා | **නැහැ** | ස්ථිර |
| `kaizen/{plantId}/{cardId}/…` | Kaizen කාඩ්පත් ඡායාරූප | බොහෝ භූමිකා (technician, trainee, store_keeper, supervisor, …) | **නැහැ** | ස්ථිර |
| `evaluation_attachments/{companyId}/…` | Evaluation ඇමුණුම් | `supervisor`, `plant_manager`, `admin`, `hr_officer` | **නැහැ** | ස්ථිර |
| `companies/{c}/staff_requests/…` | Staff request ඇමුණුම් | request එවන ඕනෑම non-admin භූමිකාවක් | **නැහැ** | ස්ථිර |
| `companies/{c}/purchaseOrders/{po}/invoice/…` | සැපයුම්කරු invoice | `store_keeper`, `supervisor`, `plant_manager`, `admin` | **නැහැ** | ස්ථිර |
| `companies/{c}/training/offboard-reports/…` | Offboard පුහුණු වාර්තා | trainee/පුහුණුකරුවෝ | **නැහැ** (function එකකින් පරිශීලනය) | ස්ථිර |
| `companies/{c}/trainee-programmes/…` | Weekend summaries, ප්‍රමාණපත්‍ර PDF | `safety_officer`, `supervisor`, `plant_manager`, `admin`, `hr_officer` | **නැහැ** | ස්ථිර |
| `triage/{pdfs,media,shared,{companyId}}/…` | Triage PDF සහ media | triage සාදන්නන් | **නැහැ** | ස්ථිර |

**ඇයි create-only?** WO ඡායාරූප, signatures, audit සාක්ෂි වැනි ඒවා පසුව වෙනස් කළොත් හෝ මැකුවොත් සාක්ෂියක් නැති වෙයි. අදාළ UI වල මැකීමේ බොත්තමක් කිසිදා නැති නිසා මේ සීමාව දැනට ඇති කිසිම ක්‍රියාවලියක් කඩන්නේ නැහැ. ඉවත් කළ හැක්කේ **Cloud Function (Admin SDK)** හරහා පමණි.

### 2.2 වෙනස් කළ හැකි (mutable) සමාගම් ෆයිල්

| Path | අන්තර්ගතය | උඩුගත කළ හැක්කේ | මැකීම/ප්‍රතිස්ථාපනය |
|---|---|---|---|
| `companies/{c}/branding/logo…` | සමාගම් logo | `admin` (settings), ලියාපදිංචියේ දී | නව logo එකකින් ප්‍රතිස්ථාපනය කළ හැක |
| `companies/{c}/machines/{id}/{photos,documents}/…` | යන්ත්‍ර ඡායාරූප/ලේඛන | `supervisor`, `plant_manager`, `admin` | ප්‍රතිස්ථාපනය/මැකීම ඇත |
| `companies/{c}/contractors/{id}/documents/…`, `…/technicians/…` | කොන්ත්‍රාත් ලේඛන, certifications, ඡායාරූප | `hr_officer`, `supervisor`, `plant_manager`, `admin` | නැවත අලුත් කිරීමේදී (renewal) ප්‍රතිස්ථාපනය |
| `companies/{c}/inventoryParts/{id}/warranty/…` | අමතර කොටස් වගකීම් ෆයිල් | `store_keeper`, `supervisor`, `plant_manager`, `admin` | මැකීම ඇත |
| `companies/{c}/training-content/…`, `companies/{c}/content/…` | පුහුණු වීඩියෝ/PDF/ඡායාරූප, content library | `safety_officer`, `supervisor`, `plant_manager`, `admin`, `hr_officer` | **content library හි "මකන්න" (deleteObject)** එකම client-මැකීම |

### 2.3 Function-පාදක ෆයිල් (client වලට ලිවිය නොහැක)

| Path | කවුද ලියන්නේ | කාල සීමාව / මැකීම |
|---|---|---|
| `reports/{companyId}/{reportId}.pdf` | `generateReport` function | **දින 30**; පසු `cleanupOldReports` (දිනපතා 03:00) ලේඛනයත් ෆයිලයත් මකයි |
| `report_schedules/{scheduleId}/{reportId}.csv` | `generateScheduledReport` (පැයකට වරක්) | `report_history` ලේඛනය **දින 30**ට මැකෙනවා (එම CSV ෆයිල් මකන්නේ `storageUrl` ඇති විට) |
| `safetyTrainingSubmissions/{company}/{invite}/attempt-N/…` | `submitContractorSafetyTraining` | නැවත submit කළ විට පරණ ෆයිල් ස්වයංක්‍රීයව මැකේ; ස්ථිර එකම අවසන් submission |
| `companies/{c}/training/offboard-reports/…/knowledge-transfer…` | `onOffboardTrainingCompleted` | ස්ථිර |

**සමාගම ස්ථිරව වසා දැමුවහොත් (`platformDeleteCompany`):** `companies`, `workorders`, `breakdowns`, `evaluation_attachments`, `safetyTrainingSubmissions`, `triage`, `reports` (මෙම වෙනස්කමෙන් එකතු කළා) යන `<root>/<companyId>/` ෆයිල් සහ audit_attachments, audit_reports, audits, kaizen යන plant-key ෆයිල් **මකා දමයි**. Audit log, Lumora විකුණුම්/වියදම් වාර්තා සහ Stripe දත්ත රැඳේ.

## 3. Firestore — රැඳවීම සහ ස්වයංක්‍රීය මැකීම

| දේ | කාලය | ක්‍රියාව |
|---|---|---|
| `report_history` | **දින 30** | `cleanupOldReports` — දිනපතා 03:00 (වතාවකට 200ක්) |
| `record_access_grants` | grant හි `expiresAt` | `purgeExpiredRecordGrants` — සෑම විනාඩි 15කට |
| Invitations | **දින 7** | කල් ඉකුත් වූ ඒවා පිළිගත නොහැක; ලේඛනය මැකෙන්නේ නැත |
| Free trial | **දින 7** (අනුමත කළ දා සිට) | `expireTrials` දිනපතා 01:30 — suspend, දත්ත රැඳේ |
| PM overdue පරීක්ෂාව | සෑම පැය 2කට | ඇඟවීම් |
| SLA | සෑම විනාඩි 5කට | breach පරීක්ෂාව |
| Shift handover පිළිගැනීම | සෑම විනාඩි 30කට | මතක් කිරීම |
| Contractor ලේඛන වලංගුභාවය | දිනපතා 07:00 | තත්ත්වය යාවත්කාලීන; මකන්නේ නැත |
| Contractor safety training | නියමිත වේලාව + උත්සාහ 3 | server එක පරීක්ෂා කරයි |
| WO / breakdown / safety case / work permit / ප්‍රමාණපත්‍ර / training වාර්තා | **කල් ඉකුත් නැත** | UI එකෙන් මකන්නේ නැත; admin ට API හරහා මැකිය හැකිව තිබුණා |

**Client UI එකෙන් සැබෑ මැකීම් (`deleteDoc`) ඇති ස්ථාන:** training modules සහ content library, PM schedules, suppliers, inventory parts (බහු), shift config, triage content, audit templates/drafts, report history. ඒවා ප්‍රධාන වශයෙන් `admin`, `supervisor`, `plant_manager`, `store_keeper`, `hr_officer` භූමිකා පාවිච්චි කරයි.

## 4. Firestore මැකීම — භූමිකාව අනුව (rules)

| ක්‍රියාව | දැන් (මෙම වෙනස්කමෙන් පසු) |
|---|---|
| `admin` ට මැකීම | **තමන්ගේ සමාගමේ** ලේඛන පමණයි (පෙර: ඕනෑම සමාගමක) |
| `supervisor` / `plant_manager` | WO, යන්ත්‍ර යාවත්කාලීන කිරීම තම සමාගමේ පමණ |
| `technician` / `trainee` | අදාළ WO හි නිශ්චිත ක්ෂේත්‍ර පමණක් යාවත්කාලීන; මැකීම නැහැ |
| `floor_operator` | breakdown සාදන්න, කියවන්න පමණයි |
| අන් සමාගමක user | කියවීම, ලිවීම, මැකීම **සියල්ල නැහැ** |
| වෙනත් සමාගමක `admin` | **නැහැ** (පෙර: WO, machines, breakdowns, safety cases ඇතුළුව සියල්ල කළ හැකිව තිබුණි) |

## 5. යෝජිත ඉදිරි පියවර (තවම කේතයේ නැත)

1. **Firestore PITR** (පසුගිය දින 7 ප්‍රතිසාධනය), **ස්වයංක්‍රීය backup** (දිනපතා, දින 30–35 රඳවා ගැනීම) සහ **Storage soft delete / object versioning** console එකෙන් සක්‍රීය කරන්න. කේත වෙනසක් අවශ්‍ය නැහැ.
2. **Soft delete:** WO, work permit, safety case, ප්‍රමාණපත්‍ර මකනවා වෙනුවට `deletedAt`/`deletedBy` ලකුණු කර, දින 90කට පසු function එකකින් පමණක් ස්ථිරව මකන්න.
3. **Delete audit log:** කවුද, කවදා, මොකක් මැකුවාද යන වාර්තාව (Cloud Function trigger).
4. **Storage role-පාදක ලිවීම:** `role` custom claim එකක් එකතු කර Storage rules වලට භූමිකාව පරීක්ෂා කිරීමට ඉඩ දෙන්න (දැන් පරීක්ෂා වන්නේ සමාගම පමණි).
5. **පරණ download token links:** සංවේදී ෆයිල් සඳහා කෙටි කාලීන signed URL එකක් (උදා. විනාඩි 15) function එකකින් දෙන්න.
6. **Retention (රඳවා ගැනීම) යෝජිත මාර්ගෝපදේශ** (නීතිමය අවශ්‍යතා ඔබේ රටේ නීතිය අනුව තහවුරු කරගන්න):

| දත්ත | යෝජිත |
|---|---|
| WO, breakdown, PM, machine history | අවම වසර 5 |
| Safety case, work permit, LOTO, safety ප්‍රමාණපත්‍ර | සාමාන්‍යයෙන් වසර 5–7 |
| Training ප්‍රමාණපත්‍ර/වාර්තා | වසර 5+ (සේවකයා ඉවත් වුවත්) |
| Report history | දින 30 (දැනටමත් ඇත) |
| Audit logs | වසර 2+ |
| Soft-delete කළ දේ | දින 90 පසු ස්ථිර මකා දැමීම |
| කල් ඉකුත් වූ Invitations | දින 30කට පසු මකන්න |

## 6. මෙම වෙනස්කම්වල ආරක්ෂක ප්‍රතිඵල (සාරාංශය)

- **Firestore:** `users` mapping/profile ස්වයං-ඉහළ නැංවීම වළක්වා ඇත; සමාගම් වෙන් කිරීම WO, breakdown, machines, permits, readings, machine history, MOE, site config සඳහා ඇත; shared triage templates customer admin ට වෙනස් කළ නොහැක.
- **Storage:** evidence create-only; HTML/SVG/script වර්ග ප්‍රතික්ෂේපය; triage folders අන් සමාගම් වලට ඉක්මවා ලිවිය නොහැක.
- **XSS:** පාඩම් HTML `DOMPurify` මගින් පිරිසිදු කරයි.
- **AI endpoint:** user කෙනෙකුට පැයකට 40, සමාගමකට දිනකට 500 ඉල්ලීම් (env වලින් වෙනස් කළ හැක).

රුල්ස් පරීක්ෂා කිරීම: `rules-tests/` හි `npm test` (Firebase emulators).
