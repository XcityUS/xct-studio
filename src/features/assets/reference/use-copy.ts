import { REFERENCE_ORIGINS, type ReferenceOrigin } from './origin';
import { useTranslations } from 'next-intl';

export function useReferenceCopy() {
    const t = useTranslations();
    const labels: Record<ReferenceOrigin, string> = {
        'no-person': t('No person in this image'),
        'official-asset': t('Official material'),
        'byteplus-ai': t('AI<dash>generated <mdash> Studio model'),
        'thirdparty-ai': t('AI<dash>generated <mdash> other model'),
        'real-person': t('A real person'),
        'public-figure': t('Public figure'),
        'licensed-ip': t('Celebrity or licensed character')
    };
    const hints: Record<ReferenceOrigin, string> = {
        'no-person': t('Review this material and bind its Asset ID before generation'),
        'official-asset': t('Use the Asset ID supplied by ModelArk or the approved offline batch'),
        'byteplus-ai': t('Made by Studio image models<dot> Usable directly'),
        'thirdparty-ai': t('External AI renders must be approved in the virtual asset library'),
        'real-person': t('An ordinary person must complete consent and face verification'),
        'public-figure': t(
            'A public figure requires likeness authorization<comma> account approval<comma> and an Asset ID'
        ),
        'licensed-ip': t('Protected IP requires rights authorization<comma> account approval<comma> and an Asset ID')
    };
    const messages: Record<string, string> = {
        'Switch to Seedance 2.0 or 2.5 before using the portrait asset library. Seedance 1.5 Pro cannot attach asset:// references.':
            t(
                'Switch to Seedance 2<dot>0 or 2<dot>5 before using the portrait asset library<dot> Seedance 1<dot>5 Pro cannot attach asset<colon><slash><slash> references'
            ),
        'Virtual portrait library is not configured on this deployment. Use AI-generated · Studio model if it came from Studio, or ask an admin to enable Assets.':
            t(
                'Virtual portrait library is not configured on this deployment<dot> Use AI<dash>generated <mdash> Studio model if it came from Studio<comma> or ask an admin to enable Assets'
            ),
        'Provider asset review is not configured on this deployment. Ask an admin to enable Assets.': t(
            'Provider asset review is not configured on this deployment<dot> Ask an admin to enable Assets'
        ),
        'Choose where this image came from.': t('Choose where this image came from'),
        'Attach the official Asset ID before submitting.': t('Attach the official Asset ID before submitting'),
        'Review this material and attach its Asset ID before submitting.': t(
            'Review this material and attach its Asset ID before submitting'
        ),
        'Add this AI-generated material to the virtual asset library before submitting.': t(
            'Add this AI<dash>generated material to the virtual asset library before submitting'
        ),
        'Verify this person and attach the approved Asset ID before submitting.': t(
            'Verify this person and attach the approved Asset ID before submitting'
        ),
        'Complete likeness authorization and attach the approved Asset ID before submitting.': t(
            'Complete likeness authorization and attach the approved Asset ID before submitting'
        ),
        'Complete IP authorization and attach the approved Asset ID before submitting.': t(
            'Complete IP authorization and attach the approved Asset ID before submitting'
        ),
        'This authorization is not approved yet. Studio approval only unblocks this reference check; final model moderation may still reject the image.':
            t(
                'This authorization is not approved yet<dot> Studio approval only unblocks this reference check<semi> final model moderation may still reject the image'
            ),
        'Submit an approved authorization document before using this public figure or licensed IP. Studio approval only unblocks this reference check; final model moderation may still reject the image.':
            t(
                'Submit an approved authorization document before using this public figure or licensed IP<dot> Studio approval only unblocks this reference check<semi> final model moderation may still reject the image'
            )
    };

    return {
        originOptions: REFERENCE_ORIGINS.map((origin) => ({ value: origin, label: labels[origin] })),
        originHint: (origin: ReferenceOrigin) => hints[origin],
        actionLabel: (origin: ReferenceOrigin) =>
            origin === 'byteplus-ai'
                ? null
                : origin === 'public-figure' || origin === 'licensed-ip'
                  ? t('Submit authorization')
                  : origin === 'thirdparty-ai'
                    ? null
                    : origin === 'real-person' || origin === 'official-asset' || origin === 'no-person'
                      ? t('Set this up in Assets')
                      : null,
        imageHint: (maxImages: number, imageCount: number) =>
            maxImages <= 1
                ? t(
                      'Image<dash>to<dash>video<colon> the clip starts from this frame<semi> the output ratio follows the image<dot> Switch to Seedance 2<dot>0<slash>2<dot>5 to use multiple reference images'
                  )
                : imageCount >= 2
                  ? t(
                        'Reference mode <mdash> cite <lbrk>Image 1<rbrk><comma> <lbrk>Image 2<rbrk> <hellip> in your prompt <lpar>up to <lcur>max<rcur> images<rpar><dot> Aspect ratio applies',
                        { max: maxImages }
                    )
                  : imageCount === 1
                    ? t(
                          'One image <eq> first<dash>frame mode <lpar>output ratio follows it<rpar><dot> Add more to switch to reference mode'
                      )
                    : t(
                          'First image starts the clip<semi> add 2<plus> <lpar>up to <lcur>max<rcur><rpar> for reference mode with <lbrk>Image n<rbrk> prompts',
                          { max: maxImages }
                      ),
        translateMessage: (message: string | null) => (message ? (messages[message] ?? message) : null)
    };
}
