// Короткая форма CTA-блока перед подвалом (ТЗ §6.3): без выбора услуг — только контакт. Eager (не
// за динамическим импортом, как квиз): форма видна на экране сразу, ждать лишний чанк на клик не
// нужно, а сама она маленькая.
import { showErrors, submitLead } from './form-submit';
import { contactFormErrors, loadUtm, readChannel, stripInvisible } from './form-utils';

function init(form: HTMLFormElement): void {
  const nameInput = form.querySelector<HTMLInputElement>('input[name="name"]');
  const contactInput = form.querySelector<HTMLInputElement>('input[name="contact"]');
  const commentInput = form.querySelector<HTMLInputElement>('input[name="comment"]');
  const consentInput = form.querySelector<HTMLInputElement>('input[name="consent"]');
  const hpInput = form.querySelector<HTMLInputElement>('input[name="website"]');
  if (!nameInput || !contactInput || !commentInput || !consentInput || !hpInput) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const name = stripInvisible(nameInput.value);
    const contact = stripInvisible(contactInput.value);
    const channel = readChannel(form);

    const errors = contactFormErrors(name, channel, contact, consentInput.checked);
    if (errors.length > 0) {
      showErrors(form, errors);
      return;
    }

    void submitLead(
      form,
      {
        form_type: 'short',
        services: [],
        details: {},
        name,
        channel,
        contact,
        comment: commentInput.value,
        consent: true,
        page: location.pathname,
        utm: loadUtm(),
        hp: hpInput.value,
      },
      'lead_short',
    );
  });
}

const form = document.querySelector<HTMLFormElement>('#short-form');
if (form) init(form);
