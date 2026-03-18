from app.providers.automobile.parser import parse_automobile_markdown
from app.providers.autoscout24.parser import parse_autoscout_markdown
from app.providers.brumbrum.parser import parse_brumbrum_markdown
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


def test_parse_autoscout_markdown_supports_unicode_euro() -> None:
    markdown = """
![img](https://prod.pictures.autoscout24.net/listing-images/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/640x480.jpg)
[Audi Q3 35 TDI](https://www.autoscout24.it/annunci/audi-q3-test)
EUR 28.900
02/2021
39.000 km
"""
    listings = parse_autoscout_markdown(markdown, "Audi", "Q3")
    assert listings
    assert listings[0].price_amount == 28900


def test_parse_autoscout_markdown_fallback_from_url_context() -> None:
    markdown = """
[Audi Q3 35 TDI S line](https://www.autoscout24.it/annunci/audi-q3-35-tdi-s-line-test)
EUR 33.400
06/2022
29.000 km
"""
    listings = parse_autoscout_markdown(markdown, "Audi", "Q3")
    assert listings
    assert listings[0].price_amount == 33400


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


def test_parse_subito_markdown_supports_unicode_euro() -> None:
    markdown = """
![img](https://images.sbito.it/test.jpg)
### Audi Q3 35 TDI
[link](https://www.subito.it/auto/audi-q3-35-tdi-test.htm)
€ 31.500
05/2022 22.000 Km
Roma (RM)
"""
    listings = parse_subito_markdown(markdown, "Audi", "Q3")
    assert listings
    assert listings[0].price_amount == 31500


def test_parse_automobile_markdown_extracts_listing() -> None:
    markdown = """
[![img](https://cdn.example.com/car.jpg)](https://www.automobile.it/annunci/test-auto)
### BMW Serie 3 320d
€ 24.900
Marzo 2021
55.000 km
"""
    listings = parse_automobile_markdown(markdown, "BMW", "Serie 3")
    assert listings
    assert listings[0].provider == "automobile"
    assert listings[0].price_amount == 24900


def test_parse_brumbrum_markdown_extracts_listing() -> None:
    markdown = """
[BMW Serie 3 320d](https://www.brumbrum.it/usato/bmw-serie-3-320d)
€ 26.500
2022
48.000 km
"""
    listings = parse_brumbrum_markdown(markdown, "BMW", "Serie 3")
    assert listings
    assert listings[0].provider == "brumbrum"
    assert listings[0].price_amount == 26500
