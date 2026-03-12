from app.providers.autoscout24.parser import parse_autoscout_markdown
from app.providers.subito.parser import parse_subito_markdown


def test_parse_autoscout_markdown_extracts_listing() -> None:
    markdown = """
![img](https://prod.pictures.autoscout24.net/listing-images/11111111-1111-1111-1111-111111111111/640x480.jpg)
[BMW 320d M Sport](https://www.autoscout24.it/annunci/bmw-320d-test)
€ 25.500
01/2020
45.000 km
"""
    listings = parse_autoscout_markdown(markdown, "BMW", "320d")
    assert listings
    assert listings[0].provider == "autoscout24"
    assert listings[0].price_amount == 25500


def test_parse_subito_markdown_extracts_listing() -> None:
    markdown = """
![img](https://images.sbito.it/test.jpg)
### BMW Serie 3 320d
[link](https://www.subito.it/auto/bmw-serie-3-320d-test.htm)
25.000 €
03/2021 60.000 Km
Milano (MI)
"""
    listings = parse_subito_markdown(markdown, "BMW", "Serie 3")
    assert listings
    assert listings[0].provider == "subito"
    assert listings[0].price_amount == 25000
