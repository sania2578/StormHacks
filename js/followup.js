/* ---------- Follow up ---------- */

function log(msg) {
  const a = store.get('timeline', []);

  a.unshift({
    m: msg,
    t: new Date().toLocaleString()
  });

  store.set(
    'timeline',
    a.slice(0, 50)
  );
}


function renderTL() {

  const a =
    store.get('timeline', []);

  $('tl').innerHTML =
    a.length

      ? a
          .map(
            x => `
              <div class="tl">
                <strong>${esc(x.m)}</strong>
                <small>${esc(x.t)}</small>
              </div>
            `
          )
          .join('')

      : `
          <p class="sub">
            ${esc(t("fuNothingYet"))}
          </p>
        `;
}


document
  .querySelectorAll('[data-s]')
  .forEach(b => {

    b.onclick = () => {

      const s =
        b.dataset.s;


      // -----------------------------------
      // Save timeline entry
      // -----------------------------------

      let statusText = s;

      if (s === 'Better') {
        statusText = t("fuBetter");
      }

      else if (s === 'Same') {
        statusText = t("fuSame");
      }

      else if (s === 'Worse') {
        statusText = t("fuWorse");
      }


      log(
        `${t("fuCheckIn")}: ${statusText}`
      );


      renderTL();


      const box =
        $('fuMsg');


      // ===================================
      // BETTER
      // ===================================

      if (s === 'Better') {

        box.innerHTML = `
          <div class="res ok">

            <strong>
              ${esc(t("fuGoodTitle"))}
            </strong>

          </div>
        `;
      }


      // ===================================
      // SAME
      // ===================================

      else if (s === 'Same') {

        box.innerHTML = `
          <div
            class="res"
            style="
              border-color:#d97706;
              background:var(--ambbg);
            "
          >

            <strong>
              ${esc(t("fuSameTitle"))}
            </strong>

            ${esc(t("fuSameDesc"))}

          </div>
        `;
      }


      // ===================================
      // WORSE
      // ===================================

      else {

        box.innerHTML = `
          <div class="res urgent">

            <strong>
              ${esc(t("fuWorseTitle"))}
            </strong>

            <br>

            <button
              class="btn"
              id="rr"
            >
              ${esc(t("fuReroute"))}
            </button>

            <a
              class="btn g"
              href="tel:811"
              style="
                text-decoration:none;
                display:inline-block;
              "
            >
              ${esc(t("fuCall811"))}
            </a>

          </div>
        `;


        $('rr').onclick = () => {

          st = {
            step: 'g'
          };

          openTab(
            'navigate'
          );

          navRender();
        };
      }
    };
  });