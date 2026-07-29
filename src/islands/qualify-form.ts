// Форма подбора под hero на главной (ТЗ §6.2): интерес + тип клиента квалифицируют лид до звонка.
// Eager, как короткая форма (см. short-form.ts) — видна сразу, без ожидания динамического чанка.
import { showErrors, submitLead } from './form-submit';
import { contactFormErrors, loadUtm, readChannel, stripInvisible } from './form-utils';

function init(form: HTMLFormElement): void {
  const interestSelect = form.querySelector<HTMLSelectElement>('select[name="interest"]');
  const clientTypeSelect = form.querySelector<HTMLSelectElement>('select[name="client_type"]');
  const needInput = form.querySelector<HTMLInputElement>('input[name="need"]');
  const nameInput = form.querySelector<HTMLInputElement>('input[name="name"]');
  const contactInput = form.querySelector<HTMLInputElement>('input[name="contact"]');
  const consentInput = form.querySelector<HTMLInputElement>('input[name="consent"]');
  const hpInput = form.querySelector<HTMLInputElement>('input[name="website"]');
  if (
    !interestSelect ||
    !clientTypeSelect ||
    !needInput ||
    !nameInput ||
    !contactInput ||
    !consentInput ||
    !hpInput
  ) {
    return;
  }

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
        form_type: 'qualify',
        services: [interestSelect.value],
        client_type: clientTypeSelect.value,
        details: {},
        name,
        channel,
        contact,
        comment: needInput.value,
        consent: true,
        page: location.pathname,
        utm: loadUtm(),
        hp: hpInput.value,
      },
      'lead_qualify',
    );
  });
}

const form = document.querySelector<HTMLFormElement>('#qualify-form');
if (form) init(form);
