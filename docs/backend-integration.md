# Backend entegrasyonu (Laravel + Laraql)

Bu belge `@medyat/react-data-table`'ı bir Laravel backend'e bağlamak için gereken her şeyi tek yerde toplar. Referans
uygulama Swors'tur (Laravel API + React SPA); aşağıdaki kod oradan alınmıştır ve çalışır durumdadır. Bir AI asistanına
"bu belgeye göre tabloyu backend'e bağla" denildiğinde baştan sona uygulanabilecek şekilde yazılmıştır.

Paket veri çekmez ve hiçbir şey kaydetmez. İstek nesnesini (`table.request`) üretir, görünüm ve tercih için iki adapter
arayüzü bekler. Backend'den üç şey gerekir:

| #   | Ne                    | Backend                                         | Frontend                                      |
| --- | --------------------- | ----------------------------------------------- | --------------------------------------------- |
| 1   | Liste verisi          | `POST api/query` (Laraql)                       | `table.request` → Laraql sorgusu → `result`   |
| 2   | Kişisel görünümler    | `list_views` tablosu + `api/list-views` uçları  | `ViewsAdapter`                                |
| 3   | Kullanıcı tercihleri  | `users.preferences` (jsonb) + `PATCH api/auth/preferences` | `PreferencesAdapter`               |

2 ve 3 isteğe bağlıdır: verilmezse paket görünüm ve tercihleri kaydetmez; `createLocalStorageViews` ve
`createLocalStoragePreferences` ile tarayıcıda da tutulabilir. Kullanıcı başka cihazda aynı görünümleri görecekse backend
gerekir.

**Önkoşullar:** PostgreSQL (jsonb operatörleri kullanılıyor; `uuidv7()` PostgreSQL 18'de yerleşik, eski sürümde
uygulamanın UUID üretimini kullanın), Sanctum ile kimliği doğrulanmış kullanıcı, React 19, TanStack Query (önerilen).

---

## 1. Liste verisi: Laraql

### Backend

```bash
composer require medyat/laraql
php artisan vendor:publish --tag="laraql-config"
```

`config/laraql.php`:

```php
return [
    'route' => [
        'path' => 'api/query',
        'middleware' => ['auth:sanctum', 'api'], // paket guard varsaymaz, kimlik doğrulamayı buraya koyun
    ],
    'sources' => [
        App\Laraql\Sources\ProductSource::class,
    ],
];
```

Her liste bir **source**'tur: model, istemcinin okuyabileceği tipli kolonlar ve seçenekler. Ayrıntılar Laraql'ın
`README.md` ve `docs/protocol.md` belgelerinde. Kısa örnek:

```php
final class ProductSource extends Source
{
    public function name(): string { return 'product'; }
    public function model(): string { return Product::class; }

    public function columns(Context $context): array
    {
        return [
            Column::id('code')->searchable(),
            Column::string('title')->searchable(),
            Column::select('status', ['draft', 'active']),
            Column::money('price', 'TRY'),
            Column::date('created_at'),
        ];
    }
}
```

### Sözleşme: paket ↔ Laraql

İkisi aynı protokol için tasarlandı; çeviri katmanı neredeyse yok.

| Paket (`table.request`)          | Laraql sorgusu        | Not                                                                      |
| -------------------------------- | --------------------- | ------------------------------------------------------------------------ |
| `filters: FilterCondition[]`     | `filters`             | 18 operatör birebir aynı (`eq`, `contains`, `between`, `within`, ...)    |
| `sort: [{ column, dir }]`        | `sort`                | Aynı biçim, en fazla 3 kural                                             |
| `page: { number, size }`         | `page`                | 1'den başlar                                                             |
| `fields: string[]`               | `fields`              | Görünür sütunların yolları                                               |
| `search: string`                 | `search`              | Boşsa göndermeyin                                                        |
| —                                | `source`, `options`, `params` | Uygulamanın ekledikleri (ör. `options: ["only_trashed"]`)        |

**Kural:** `ColumnDef.id` ile Laraql kolon adı aynıdır (`code`, `company.title`, `variables.color`). Farklı olursa
filtre ve sıralama yanlış kolona gider.

İstek ve yanıt:

```jsonc
// POST api/query
{ "queries": { "result": { "source": "product", "fields": ["code", "title"], "page": { "number": 1, "size": 100 } } } }

// 200
{ "results": { "result": { "rows": [...], "page": { "number": 1, "size": 100, "hasMore": true }, "ignored": ["sort.0"] } } }

// Sorgu hatası da 200 ile gelir: { "results": { "result": { "error": { "type": "...", "status": 422, "errors": {...} } } } }
```

- Toplam sayı yoktur; `hasMore` `size + 1` satır okunarak bulunur. Toplam istenirse `kind: "count"` sorgusu ayrı
  gönderilir ve `useDataTable({ count })` ile footer'daki "Count total"a bağlanır.
- `ignored`: sunucunun atladığı yollar (eski bir görünümde kalmış, artık olmayan sütun gibi). Satırlar doğrudur, liste
  çalışmaya devam eder.

### Frontend

`lib/laraql.ts` (Swors'taki hali; `api` uygulamanın axios örneğidir):

```ts
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { FilterCondition, SortRule } from '@medyat/react-data-table'

export type LaraqlQuery = {
  source: string
  fields?: string[]
  filters?: FilterCondition[]
  sort?: SortRule[]
  page?: { number: number; size: number }
  search?: string
  options?: string[]
  params?: Record<string, unknown>
}

export type LaraqlResult<TRow> = {
  rows: TRow[]
  page: { number: number; size: number; hasMore: boolean }
  ignored?: string[]
}

async function runQuery<TRow>(query: LaraqlQuery, signal?: AbortSignal) {
  const { data } = await api.post('api/query', { queries: { result: query } }, { signal })
  const result = data.results.result
  // Sorgu hatası HTTP 200 ile gelir; fırlatılmazsa TanStack Query başarı sayar.
  if ('error' in result) throw toError(result.error)
  return result as LaraqlResult<TRow>
}

export const laraqlQueryOptions = <TRow>(query: LaraqlQuery) =>
  queryOptions({
    queryKey: ['laraql', query],
    queryFn: ({ signal }) => runQuery<TRow>(query, signal),
    placeholderData: keepPreviousData, // filtre/sayfa değişirken eski satırlar yerinde kalsın
  })
```

Ekran:

```tsx
const table = useDataTable({
  id: 'products', // görünüm ve tercihlerin anahtarı (list_key); [a-z0-9-]
  columns,
  entityName: { one: 'product', other: 'products' },
  views: [{ id: 'all', name: t('products.views.all'), kind: 'system', state: {}, default: true }],
})
const { search, ...rest } = table.request
const result = useQuery({
  ...laraqlQueryOptions<ProductListItem>({ source: 'product', ...rest, ...(search && { search }) }),
  select: (d) => ({ rows: d.rows, hasMore: d.page.hasMore }),
})
return <DataTable table={table} result={result} />
```

---

## 2. Kişisel görünümler: `list_views`

Görünüm = filtre + sıralama + sütun düzeni (`ViewState`). Arama, yoğunluk ve sayfa görünüme yazılmaz. Sunucu `state`'i
yorumlamaz, olduğu gibi saklar. Kayıt yalnızca sahibine görünür; paylaşım yoktur.

### Migration

```php
Schema::create('list_views', function (Blueprint $table) {
    $table->uuid('id')->primary()->default(DB::raw('uuidv7()'));
    // Çok kiracılı uygulamada: $table->unsignedInteger('tenant_id')->index();
    $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete(); // users.id int ise foreignId
    // İstemcinin tablo kimliği (`useDataTable({ id })`); sunucu bu listeyi tanımaz, yalnızca gruplar.
    $table->string('list_key', 64);
    $table->string('name', 60);
    // Paketin {filters, sort, columns} anlık görüntüsü.
    $table->jsonb('state');
    $table->timestamps();
});

// Ad, aynı kullanıcının aynı listesinde büyük/küçük harf farkı gözetmeden tekildir.
DB::statement('CREATE UNIQUE INDEX list_views_owner_name_unique ON list_views (user_id, list_key, lower(name))');
```

Çok kiracılıysa `tenant_id`'yi indeksin başına ekleyin ve modele kiracı kapsamını (Swors'ta `IsTenantModel`) verin.

### Model

```php
class ListView extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['state' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

`id` UUID ise modele `HasUuids` ekleyin ya da veritabanı varsayılanına bırakın (Swors ikincisini kullanır).

### Uç noktalar

```php
Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('list-views', ListViewController::class)->only(['index', 'store', 'update', 'destroy']);
});
```

| Metot    | Yol                       | Gövde / parametre                          | Yanıt                                  |
| -------- | ------------------------- | ------------------------------------------ | -------------------------------------- |
| `GET`    | `api/list-views?list=products` | —                                     | `{ data: [{ id, name, state, updated_at }] }`, ada göre sıralı |
| `POST`   | `api/list-views`          | `{ list, name, state }`                    | `{ data: { id, name, state, updated_at } }` |
| `PUT`    | `api/list-views/{id}`     | `{ name?, state? }` (`list` yasak)         | `{ data: { id, name, state, updated_at } }` |
| `DELETE` | `api/list-views/{id}`     | —                                          | `204`                                  |

Başkasının kaydı **404** döner (403 değil): kaydın varlığı sızdırılmaz.

### Controller

```php
class ListViewController extends Controller
{
    public function index(Request $request)
    {
        $request->validate(['list' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/']]);

        return JsonResource::collection(
            ListView::query()
                ->whereBelongsTo($request->user())
                ->where('list_key', $request->query('list'))
                ->orderBy('name')
                ->get(['id', 'name', 'state', 'updated_at'])
        );
    }

    public function store(ListViewRequest $request)
    {
        $data = $request->validated();

        return $this->output(ListView::create([
            'user_id' => $request->user()->getKey(),
            'list_key' => $data['list'],
            'name' => $data['name'],
            'state' => $data['state'],
        ]));
    }

    public function update(ListViewRequest $request, ListView $listView)
    {
        $this->guardOwner($request, $listView);
        $listView->update($request->validated());

        return $this->output($listView);
    }

    public function destroy(Request $request, ListView $listView, DeleteListViewAction $delete)
    {
        $this->guardOwner($request, $listView);
        $delete($listView);

        return response()->noContent();
    }

    private function guardOwner(Request $request, ListView $listView): void
    {
        abort_unless($listView->user_id === $request->user()->getKey(), 404);
    }

    private function output(ListView $listView): JsonResource
    {
        return new JsonResource($listView->only(['id', 'name', 'state', 'updated_at']));
    }
}
```

### Doğrulama

```php
class ListViewRequest extends FormRequest
{
    private const int MAX_STATE_BYTES = 32768;

    public function rules(): array
    {
        $listView = $this->route('list_view');
        $required = $listView ? 'sometimes' : 'required';

        return [
            'list' => [$listView ? 'prohibited' : 'required', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/'],
            'name' => [$required, 'string', 'max:60', $this->uniqueName($listView)],
            'state' => [$required, 'array:filters,sort,columns', function ($attribute, $value, $fail) {
                if (strlen(json_encode($value)) > self::MAX_STATE_BYTES) {
                    $fail('validation.max.string')->translate(['max' => self::MAX_STATE_BYTES]);
                }
            }],
            'state.filters' => ['sometimes', 'array'],
            'state.sort' => ['sometimes', 'array'],
            'state.columns' => ['sometimes', 'array'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('name')) {
            $this->merge(['name' => trim((string) $this->input('name'))]);
        }
    }

    // Veritabanı indeksiyle aynı kural; indeks yarışta son savunmadır, bu kural kullanıcıya alan hatası verir.
    private function uniqueName(?ListView $listView): Closure
    {
        return function ($attribute, $value, $fail) use ($listView) {
            $taken = ListView::query()
                ->where('user_id', $this->user()->getKey())
                ->where('list_key', $listView?->list_key ?? $this->input('list'))
                ->whereRaw('lower(name) = lower(?)', [$value])
                ->when($listView, fn ($q) => $q->whereKeyNot($listView->getKey()))
                ->exists();

            if ($taken) {
                $fail('validation.unique')->translate();
            }
        };
    }
}
```

Paket ad çakışmasındaki 422'yi kaydetme penceresinde `name` alanının altında gösterir; mesaj backend'den gelir.

### Silme: varsayılan tercihi de temizle

Silinen görünüm kullanıcının o listedeki varsayılanıysa tercihten de düşülür; yoksa istemci olmayan bir id'ye açılır.

```php
class DeleteListViewAction
{
    public function __invoke(ListView $listView): void
    {
        DB::transaction(function () use ($listView) {
            $listView->delete();

            // list_key [a-z0-9-] ile sınırlı; dizi literal'inde kaçış gerekmez.
            User::query()
                ->whereKey($listView->user_id)
                ->whereRaw('preferences #>> ?::text[] = ?', ["{lists,{$listView->list_key},default_view_id}", $listView->getKey()])
                ->update(['preferences' => DB::raw("preferences #- '{lists,{$listView->list_key},default_view_id}'")]);
        });
    }
}
```

---

## 3. Tercihler: `users.preferences`

Yoğunluk, dikey çizgiler ve varsayılan görünüm. Biçim:

```json
{ "lists": { "products": { "default_view_id": "0193…", "density": "compact", "vertical_lines": true } } }
```

Swors sayfa boyutunu adreste tutar, tercihe yazmaz. Adresi kullanmayan bir uygulamada `page_size` alanını aynı kalıpla
ekleyebilirsiniz.

### Migration ve model

```php
Schema::table('users', function (Blueprint $table) {
    $table->jsonb('preferences')->nullable();
});
```

`User` modelinde:

```php
protected $hidden = [/* ... */, 'preferences']; // yalnızca kendi profilinde döner
protected function casts(): array { return [/* ... */ 'preferences' => 'array']; }
```

Profil kaynağına (`GET api/auth/profile` ya da uygulamadaki karşılığı) `'preferences' => $this->preferences` ekleyin.
Yeni kullanıcıda `null` gelir; bazı yanıt sarmalayıcıları boş nesneyi `[]` yazar, istemci alanları isteğe bağlı okumalı.

### Uç nokta

```php
Route::patch('auth/preferences', [ProfileController::class, 'preferences'])->middleware('auth:sanctum');
```

```php
public function preferences(UpdatePreferencesRequest $request, UpdateUserPreferencesAction $update)
{
    $update($request->user(), $request->validated('lists'));

    return new UserProfileResource($request->user()->fresh()); // güncel profil döner
}
```

Her istek kısmi bir yamadır: `{ "lists": { "products": { "density": "compact" } } }` yalnızca o alanı değiştirir.

```php
class UpdatePreferencesRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'lists' => ['required', 'array', 'min:1', 'max:10', function ($attribute, array $value, $fail) {
                foreach (array_keys($value) as $key) {
                    if (! is_string($key) || strlen($key) > 64 || ! preg_match('/^[a-z0-9-]+$/', $key)) {
                        $fail('validation.regex')->translate();
                    }
                }
            }],
            'lists.*' => ['required', 'array:default_view_id,density,vertical_lines', 'min:1'],
            'lists.*.default_view_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'lists.*.density' => ['sometimes', Rule::in(['comfortable', 'standard', 'compact'])],
            'lists.*.vertical_lines' => ['sometimes', 'boolean'],
        ];
    }
}
```

Birleştirme veritabanında yapılır: iki sekme farklı alanları aynı anda yazınca biri diğerini ezmez. Kullanıcı başına
64 KB sınırı, bilinmeyen liste anahtarlarıyla sütunun şişirilmesini engeller.

```php
class UpdateUserPreferencesAction
{
    public const int MAX_BYTES = 65536;

    public function __invoke(User $user, array $lists): void
    {
        DB::transaction(function () use ($user, $lists) {
            foreach ($lists as $key => $values) {
                $updated = DB::update(<<<'SQL'
                    UPDATE users SET preferences = jsonb_set(
                        coalesce(preferences, '{}'),
                        '{lists}',
                        coalesce(preferences -> 'lists', '{}') || jsonb_build_object(
                            ?::text,
                            coalesce(preferences #> ?::text[], '{}') || ?::jsonb
                        )
                    )
                    WHERE id = ? AND octet_length(coalesce(preferences, '{}')::text) < ?
                    SQL, [$key, "{lists,{$key}}", json_encode((object) $values), $user->getKey(), self::MAX_BYTES]);

                abort_if($updated === 0, 422, __('messages.preferences.too_large'));
            }
        });
    }
}
```

---

## 4. Frontend: adapter'lar ve sağlayıcı

Sunucu `snake_case` döner, paket `camelCase` bekler; çeviri adapter'dadır. Aşağıdaki kod yanıtların `{ data: ... }`
zarfıyla geldiğini ve `api`'nin zarfı açtığını varsayar (Swors'ta öyle); farklıysa yalnızca `data` okumalarını uyarlayın.

```ts
import type { PreferencesAdapter, View, ViewsAdapter } from '@medyat/react-data-table'

type ListView = Pick<View, 'id' | 'name' | 'state'> & { updated_at: string }

const toView = ({ updated_at, ...view }: ListView): View => ({ ...view, kind: 'personal', updatedAt: updated_at })

// Eksik alan pakete `undefined` olarak gitmemeli: tercihin yokluğu varsayılanı ezmesin.
const defined = <T extends object>(object: T) =>
  Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined)) as Partial<T>

const profileKey = profileQueryOptions().queryKey
const viewsKey = (list: string) => ['list-views', list]

// Görünümler yalnızca bu adapter'dan değişir: önbellek yazımlarla güncel tutulur, hiç bayatlamaz.
// Aynı anda gelen iki çağrı (StrictMode) tek isteği paylaşır.
const updateViews = (list: string, change: (views: View[]) => View[]) =>
  queryClient.setQueryData<View[]>(viewsKey(list), (views) => (views ? change(views) : views))

export const viewsAdapter: ViewsAdapter = {
  list: (list) =>
    queryClient.fetchQuery({
      queryKey: viewsKey(list),
      queryFn: async ({ signal }) => {
        const { data } = await api.get<ListView[]>('api/list-views', { params: { list }, signal })
        return data.map(toView)
      },
      staleTime: Infinity,
    }),
  async create(list, input) {
    const { data } = await api.post<ListView>('api/list-views', { list, ...input })
    const view = toView(data)
    updateViews(list, (views) => [...views, view])
    return view
  },
  async update(list, id, patch) {
    const { data } = await api.put<ListView>(`api/list-views/${id}`, patch)
    const view = toView(data)
    updateViews(list, (views) => views.map((v) => (v.id === id ? view : v)))
    return view
  },
  async remove(list, id) {
    await api.delete(`api/list-views/${id}`)
    updateViews(list, (views) => views.filter((v) => v.id !== id))
    // Sunucu silinen varsayılanı tercihten temizledi; profil önbelleği de aynısını yapmalı.
    queryClient.setQueryData(profileKey, (profile) => {
      const saved = profile?.preferences?.lists?.[list]
      if (!profile || saved?.default_view_id !== id) return profile
      return {
        ...profile,
        preferences: {
          ...profile.preferences,
          lists: { ...profile.preferences?.lists, [list]: { ...saved, default_view_id: undefined } },
        },
      }
    })
  },
}

/** Tercihler profil önbelleğinden eşzamanlı okunur: profil, tablo açılmadan önce yüklenmiş olmalı. */
export const preferencesAdapter: PreferencesAdapter = {
  get(list) {
    const saved = queryClient.getQueryData(profileKey)?.preferences?.lists?.[list]
    return defined({
      density: saved?.density,
      verticalLines: saved?.vertical_lines,
      defaultViewId: saved?.default_view_id,
    })
  },
  async set(list, { density, verticalLines, defaultViewId }) {
    const patch = defined({ density, vertical_lines: verticalLines, default_view_id: defaultViewId })
    if (!Object.keys(patch).length) return

    const { data } = await api.patch('api/auth/preferences', { lists: { [list]: patch } })
    queryClient.setQueryData(profileKey, data)
  },
}
```

Sağlayıcı, oturum açılmış düzenin (layout) en dışına bir kez konur:

```tsx
import { DataTableProvider } from '@medyat/react-data-table'
import '@medyat/react-data-table/style.css'
import '@medyat/react-data-table/shadcn-bridge.css' // shadcn teması varsa; HSL tema: shadcn-bridge-hsl.css

<DataTableProvider locale={i18n.language} viewsAdapter={viewsAdapter} preferences={preferencesAdapter}>
  <Outlet />
</DataTableProvider>
```

`preferences.get` eşzamanlıdır: profil sorgusu bu düzenin route loader'ında (`ensureQueryData`) beklenmelidir, yoksa
ilk açılışta tercihler boş okunur.

### Durumu adrese bağlamak (isteğe bağlı)

Swors filtre, sıralama, arama, sayfa ve görünümü URL'de tutar; paylaşılan bağlantı aynı listeyi açar. README'deki
"Durumu adrese bağlamak" bölümüne bakın. Swors'ta `useListState(search)` bunu yapar ve route `validateSearch`'ü elle
bozulmuş değeri sessizce atar (`zod` + `.catch(undefined)`).

---

## 5. AI için uygulama listesi

Sırayla:

1. **Backend, Laraql:** `medyat/laraql` kur, `config/laraql.php`'de `route.path = 'api/query'` ve `auth:sanctum`, listedeki
   her ekran için bir `Source` yaz ve `sources`'a ekle.
2. **Backend, görünümler:** `list_views` migration'ı + tekillik indeksi, `ListView` modeli, `ListViewRequest`,
   `ListViewController`, `DeleteListViewAction`, `api/list-views` route'u.
3. **Backend, tercihler:** `users.preferences` jsonb, `User::$hidden` + cast, profil yanıtına `preferences`,
   `UpdatePreferencesRequest`, `UpdateUserPreferencesAction`, `PATCH api/auth/preferences`,
   `messages.preferences.too_large` çevirisi.
4. **Backend testleri:** başkasının görünümü 404; ad harf farkı gözetmeden tekil; varsayılan görünüm silinince tercih
   temizlenir; tercih yaması öteki alanları korur; 64 KB sınırı 422.
5. **Frontend:** paketi ve peer'ları kur (`@base-ui/react`, `@phosphor-icons/react`, `write-excel-file`), CSS'leri içe aktar,
   `laraqlQueryOptions`, iki adapter, `DataTableProvider`, profili layout loader'ında yükle.
6. **Her liste ekranı:** `useDataTable({ id, columns, views })`; `id` = `list_key` (`[a-z0-9-]`, en fazla 64);
   `ColumnDef.id` = Laraql kolon adı; boş `search`'ü gönderme; `select` ile `{ rows, hasMore }`'a çevir.

## Sık hatalar

- **Laraql hatası başarı sayılıyor:** sorgu hatası HTTP 200 içinde `{ error }` olarak gelir; `queryFn` fırlatmalıdır.
- **Tercihler ilk açılışta uygulanmıyor:** profil, tablo çizilmeden önce önbellekte değil.
- **`undefined` tercih varsayılanı eziyor:** adapter eksik alanları nesneden çıkarmalı (`defined`).
- **Silinen varsayılan görünüm:** sunucu temizler, ama profil önbelleği de güncellenmezse liste olmayan görünüme açılır.
- **Ad çakışması 500 dönüyor:** doğrulama kuralı yok, yalnızca indeks var; kural 422 ve alan hatası üretir.
- **Görünüm sütunu artık yok:** sorun değil; Laraql `ignored`'a yazar, tablo bilinmeyen sütunu atlar.
