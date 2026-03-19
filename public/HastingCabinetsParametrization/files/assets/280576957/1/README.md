# Drawer Overlay System — Frontend інтеграція

## Drawer Widget Renderer

Система відображає UI елементи для кожного drawer (шухляди) кабінету:
- **Open widget** — іконка indicator (✓) + кнопка "Open Drawer"
- **Close widget** — кнопка "Close" (видима в edit mode)

### Дефолтна поведінка

Без кастомізації система рендерить:
- Кнопку "Open Drawer" для кожного drawer
- Іконку ✓ (темне коло з галочкою) якщо drawer має заповнені dividers
- Кнопку "Close" при відкритому drawer (edit mode)

### Кастомізація: `onDrawerWidgetRender`

Фронтенд повністю контролює DOM через callback:

```javascript
ConfiguratorAPI.onDrawerWidgetRender((drawerInfo, parentEl) => {
    // drawerInfo — дані про drawer
    // parentEl — порожній DOM контейнер (div)

    parentEl.innerHTML = `
        ${drawerInfo.hasOccupiedDividers
            ? '<div class="my-indicator">✓</div>'
            : ''
        }
        <button class="my-open-btn">Open Drawer</button>
    `;

    // ОБОВ'ЯЗКОВО: click handler для відкриття drawer
    parentEl.querySelector('.my-open-btn')?.addEventListener('click', () => {
        ConfiguratorAPI.showTopView(drawerInfo.cabinetId, drawerInfo.drawerType);
    });
});
```

### `drawerInfo` — структура даних

| Поле | Тип | Опис |
|------|-----|------|
| `cabinetId` | `string` | ID кабінету (`'Sink-Base-abc123'`) |
| `drawerType` | `string` | Тип drawer: `'Top'`, `'TopFull'`, `'Bot'` |
| `hasOccupiedDividers` | `boolean` | Чи є заповнені dividers |
| `dividerCount` | `number` | Кількість dividers |
| `dividerTypes` | `string[]` | Типи dividers (`['A', 'B']`) |

### Кастомізація Close widget

```javascript
ConfiguratorAPI.onDrawerCloseWidgetRender((drawerInfo, parentEl) => {
    parentEl.innerHTML = `
        <button class="my-close-btn">Close Drawer</button>
    `;

    parentEl.querySelector('.my-close-btn')?.addEventListener('click', () => {
        ConfiguratorAPI.exitTopView();
    });
});
```

### Скинути на дефолтний рендер

```javascript
ConfiguratorAPI.onDrawerWidgetRender(null);
ConfiguratorAPI.onDrawerCloseWidgetRender(null);
```

### Приклади

#### Мінімальний — тільки кнопка

```javascript
ConfiguratorAPI.onDrawerWidgetRender((info, el) => {
    const btn = document.createElement('button');
    btn.textContent = 'Open';
    btn.onclick = () => ConfiguratorAPI.showTopView(info.cabinetId, info.drawerType);
    el.appendChild(btn);
});
```

#### З кількістю dividers

```javascript
ConfiguratorAPI.onDrawerWidgetRender((info, el) => {
    el.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
            ${info.hasOccupiedDividers
                ? `<span style="background:#282828; color:white; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-size:12px;">${info.dividerCount}</span>`
                : ''
            }
            <button style="background:#A05535; color:white; border:none; border-radius:12px; padding:4px 10px; cursor:pointer; font-size:11px;"
                onclick="ConfiguratorAPI.showTopView('${info.cabinetId}', '${info.drawerType}')">
                Open Drawer
            </button>
        </div>
    `;
});
```

#### Annotation-style (hover з tooltip)

```javascript
ConfiguratorAPI.onDrawerWidgetRender((info, el) => {
    el.style.cssText = 'pointer-events: auto; cursor: pointer;';
    el.innerHTML = `
        <div class="drawer-annotation" style="
            background: ${info.hasOccupiedDividers ? '#282828' : '#A05535'};
            width: 30px; height: 30px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
        ">
            ${info.hasOccupiedDividers
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M16.6667 5L7.50001 14.1667L3.33334 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M0.75 6.58333H12.4167M6.58333 0.75V12.4167" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            }
        </div>
        <div class="drawer-tooltip" style="
            display: none;
            position: absolute;
            left: 110%;
            top: 0;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 11px;
            white-space: nowrap;
        ">
            ${info.hasOccupiedDividers
                ? `${info.dividerCount} divider${info.dividerCount > 1 ? 's' : ''} (${info.dividerTypes.join(', ')})`
                : 'Open Drawer'
            }
        </div>
    `;

    el.onmouseover = () => el.querySelector('.drawer-tooltip').style.display = 'block';
    el.onmouseout = () => el.querySelector('.drawer-tooltip').style.display = 'none';
    el.onclick = () => ConfiguratorAPI.showTopView(info.cabinetId, info.drawerType);
});
```

### Автоматичне оновлення

Callback перевикликається автоматично коли:
- Додано/видалено divider (`placeDividerToSlot`)
- Змінено конфігурацію кабінету (`setConfig`, `setConfigBatch`)
- Вихід з edit mode (`exitTopView`)
- Ручний виклик `setVisibleDrawerButtons(true)`

Фронтенд **не потрібно** викликати rescan вручну.

### Drawer Types

| Drawer Type | Cabinet | Опис |
|-------------|---------|------|
| `Top` | Sink-Base | Верхня шухляда з siphon зонами |
| `TopFull` | Sink-Cabinet | Верхня шухляда без siphon (повна ширина) |
| `Bot` | Всі | Нижня шухляда |
