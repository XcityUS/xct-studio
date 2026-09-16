import { REFERENCE_ORIGINS, type ReferenceOrigin } from './origin';
import { useTranslations } from 'next-intl';

export function useReferenceCopy() {
    const t = useTranslations();
    const labels: Record<ReferenceOrigin, string> = {
        'no-person': t('No person in this image'),
        'official-asset': t('Official material'),
        'byteplus-ai': t('AI<dash>generated <mdash> Studio'),
        'thirdparty-ai': t('AI<dash>generated <mdash> other model'),
        'real-person': t('A real person'),
        'public-figure': t('Public figure'),
        'licensed-ip': t('Celebrity or licensed character')
    };
    const hints: Record<ReferenceOrigin, string> = {
        'no-person': t('Review this material and bind its Asset ID before generation'),
        'official-asset': t('Use an existing approved Asset ID'),
        'byteplus-ai': t('Created in Studio<dot> Ready to use'),
        'thirdparty-ai': t('External AI renders must be approved in the virtual asset library'),
        'real-person': t('An ordinary person must complete consent and face verification'),
        'public-figure': t('Complete the required authorization and submit this public figure for review'),
        'licensed-ip': t('Complete the required authorization and submit this protected IP for review')
    };
    const messages: Record<string, string> = {
        'Current model does not support person assets. Switch to a compatible model.': t(
            'The current model does not support person assets<dot> Switch to a compatible model'
        ),
        'Virtual portrait library is not configured on this deployment. Use AI-generated · Seedream only for Seedream output, or ask an admin to enable Assets.':
            t(
                'Virtual character assets are not available<dot> Use Studio<dash>generated only for images created in Studio<comma> or ask an administrator to enable Assets'
            ),
        'Provider asset review is not configured on this deployment. Ask an admin to enable Assets.': t(
            'Asset review is not available<dot> Ask an administrator to enable Assets'
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
        'Submit this public figure image for asset review before generating.': t(
            'Submit this public figure image for asset review before generating'
        ),
        'Submit this IP image for asset review before generating.': t(
            'Submit this IP image for asset review before generating'
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
                : origin === 'thirdparty-ai' || origin === 'public-figure' || origin === 'licensed-ip'
                  ? null
                  : origin === 'real-person' || origin === 'official-asset' || origin === 'no-person'
                    ? t('Set this up in Assets')
                    : null,
        imageHint: (maxImages: number, imageCount: number) =>
            maxImages <= 1
                ? t(
                      'Image<dash>to<dash>video<colon> the clip starts from this frame<semi> the output ratio follows the image<dot> Switch to a compatible model to use multiple reference images'
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
